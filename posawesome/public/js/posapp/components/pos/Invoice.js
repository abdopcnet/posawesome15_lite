// ===== IMPORTS =====
import { evntBus } from "../../bus";
import format from "../../format";
import Customer from "./Customer.vue";
import { API_MAP } from "../../api_mapper.js";

// ===== COMPONENT =====
export default {
  name: "Invoice",

  mixins: [format],

  components: {
    Customer,
  },

  props: {
    is_payment: {
      type: Boolean,
      default: false,
    },
    offerApplied: {
      type: Object,
      default: null,
    },
    offerRemoved: {
      type: [Boolean, Object], // Allow both Boolean and Object
      default: false,
    },
  },

  // ===== DATA =====
  data() {
    return {
      pos_profile: null,
      pos_opening_shift: null,
      stock_settings: null,
      invoice_doc: null,
      return_doc: null,
      customer: "",
      customer_info: {},
      additional_discount_percentage: 0,
      offer_discount_percentage: 0,
      total_tax: 0,
      items: [],
      posa_offers: [],
      discount_percentage_offer_name: null,
      float_precision: 2,
      currency_precision: 2,
      invoice_posting_date: false,
      posting_date: frappe.datetime.nowdate(),
      quick_return_value: false,

      isUpdatingTotals: false,
      // Simple State Management
      _itemOperationTimer: null,
      _updatingFromAPI: false,

      // ===== OFFER CACHING (Simple) =====
      _sessionOffers: [],      // All offers from Pos.js
      _lastCustomer: null,     // Track customer changes

      // Table Headers Configuration
      items_headers: [
        {
          title: __("Item Name"),
          align: "start",
          sortable: true,
          key: "item_name",
          width: "12%",
        },
        {
          title: __("Qty"),
          key: "qty",
          align: "center",
          width: "11%",
        },
        {
          title: frappe._("UOM"),
          key: "uom",
          align: "center",
          width: "10%",
        },
        {
          title: "list_price",
          key: "price_list_rate",
          align: "center",
          width: "12%",
        },
        {
          title: "dis_price",
          key: "rate",
          align: "center",
          width: "12%",
        },
        {
          title: "dis_%",
          key: "discount_percentage",
          align: "center",
          width: "13%",
        },
        {
          title: "dis_amount",
          key: "discount_amount",
          align: "center",
          width: "12%",
        },
        {
          title: frappe._("Total"),
          key: "amount",
          align: "center",
          width: "13%",
        },
        {
          title: frappe._("Delete"),
          key: "actions",
          align: "end",
          sortable: false,
          width: "5%",
        },
      ],
    };
  },

  // ===== COMPUTED =====
  computed: {
    dynamicHeaders() {
      let headers = [...this.items_headers];

      if (!this.pos_profile?.posa_display_discount_percentage) {
        headers = headers.filter(
          (header) => header.key !== "discount_percentage"
        );
      }

      if (!this.pos_profile?.posa_display_discount_amount) {
        headers = headers.filter((header) => header.key !== "discount_amount");
      }

      if (!this.pos_profile?.posa_allow_user_to_edit_item_discount) {
        headers = headers.filter((header) => header.key !== "rate");
      }

      return headers;
    },
    readonly() {
      return this.invoice_doc?.is_return || false;
    },
    defaultPaymentMode() {
      const invoicePayments =
        this.invoice_doc && Array.isArray(this.invoice_doc?.payments)
          ? this.invoice_doc?.payments
          : [];
      const profilePayments =
        this.pos_profile && Array.isArray(this.pos_profile?.payments)
          ? this.pos_profile?.payments
          : [];
      const payments = invoicePayments.length
        ? invoicePayments
        : profilePayments;

      // First try to find a payment marked as default
      let defaultRow = payments.find((payment) => payment.default == 1);

      // If no default payment is found, use the first payment as default
      if (!defaultRow && payments.length > 0) {
        defaultRow = payments[0];
      }

      return defaultRow ? defaultRow.mode_of_payment : null;
    },
    canPrintInvoice() {
      if (this.readonly || !this.items?.length) return false;
      return this.hasValidPayments() || !!this.defaultPaymentMode;
    },
    hasItems() {
      return this.items && this.items.length > 0;
    },
    hasChosenPayment() {
      // Allow printing if there are valid payments OR default payment mode is available
      return this.hasValidPayments() || !!this.defaultPaymentMode;
    },

    // Computed property for real-time tax amount display
    computedTaxAmount() {
      return flt(this.invoice_doc?.total_taxes_and_charges || 0, this.currency_precision);
    },

    // Computed property for net total (before tax)
    computedNetTotal() {
      return flt(this.invoice_doc?.net_total || 0, this.currency_precision);
    },

    // Computed property for grand total (after tax)
    computedGrandTotalWithTax() {
      return flt(this.invoice_doc?.grand_total || 0, this.currency_precision);
    },

    // Computed property for discount amount (calculated from percentage)
    // This mirrors ERPNext's automatic calculation: discount_amount = total × percentage / 100
    computedDiscountAmount() {
      const total = flt(this.invoice_doc?.total || 0);
      const percentage = flt(this.additional_discount_percentage || 0);
      return flt((total * percentage) / 100, this.currency_precision);
    },
  },

  methods: {
    // Shared tax calculation utility - ensures consistency between frontend and backend
    calculateTax(subtotal, taxType, taxPercent) {
      if (!taxPercent || taxPercent === 0) return 0;

      let taxAmount = 0;
      if (taxType === 'Inclusive') {
        // For inclusive tax: extract tax from the total
        // Formula: tax = total - (total / (1 + rate/100))
        taxAmount = subtotal - (subtotal / (1 + taxPercent / 100));
      } else if (taxType === 'Exclusive') {
        // For exclusive tax: add tax to the total
        // Formula: tax = total * (rate/100)
        taxAmount = subtotal * (taxPercent / 100);
      }

      return flt(taxAmount, this.currency_precision);
    },

    onQtyChange(item) {
      const newQty = Number(item.qty) || 0;
      item.qty = newQty;

      item.amount = this.calculateItemAmount(item);
      this.updateInvoiceDocLocally();
    },

    onQtyInput(item) {
      // Handle input events - use same logic as onQtyChange but without debounce
      this.onQtyChange(item);
    },

    increaseQuantity(item) {
      item.qty = (Number(item.qty) || 0) + 1;
      item.amount = this.calculateItemAmount(item);
      evntBus.emit("item_updated", item);
      this.updateInvoiceDocLocally();
    },

    decreaseQuantity(item) {
      const newQty = Math.max(0, (Number(item.qty) || 0) - 1);
      if (newQty === 0) {
        this.remove_item(item);
      } else {
        item.qty = newQty;
        item.amount = this.calculateItemAmount(item);
        evntBus.emit("item_updated", item);
        this.updateInvoiceDocLocally();
      }
    },

    getDiscountAmount(item) {
      if (!item) return 0;
      if (item.discount_amount) return flt(item.discount_amount) || 0;

      const basePrice = flt(item.price_list_rate) || flt(item.rate) || 0;
      const discountPercentage = flt(item.discount_percentage) || 0;
      return discountPercentage > 0 && basePrice > 0
        ? flt((basePrice * discountPercentage) / 100) || 0
        : 0;
    },

    quick_return() {
      // Enable Quick Return Mode - creates return invoice without linking to previous invoice
      evntBus.emit("set_customer_readonly", true);
      this.invoiceType = "Return";
      this.invoiceTypes = ["Return"];
      evntBus.emit("update_invoice_type", this.invoiceType);
      this.quick_return_value = true;
      evntBus.emit("toggle_quick_return", this.quick_return_value);

      // Create new invoice_doc with is_return flag
      if (!this.invoice_doc) {
        this.invoice_doc = {
          is_return: 1,
          __islocal: 1
        };
        evntBus.emit("update_invoice_doc", this.invoice_doc);
      } else {
        // Update existing invoice_doc
        this.invoice_doc.is_return = 1;
        evntBus.emit("update_invoice_doc", this.invoice_doc);
      }
    },

    remove_item(item) {
      const index = this.items.findIndex(
        (el) => el.posa_row_id == item.posa_row_id
      );
      if (index >= 0) {
        this.items.splice(index, 1);
        this.updateInvoiceDocLocally();
        // في نهج __islocal: إذا لم يبقى أصناف، نعيد تعيين الجلسة
        if (this.items.length === 0) {
          this.reset_invoice_session();
        } else {
          evntBus.emit("item_removed", item);
        }
      }
    },

    async add_item(item) {
      if (!item?.item_code) return;

      const new_item = Object.assign({}, item);
      new_item.uom = new_item.uom || new_item.stock_uom || "Nos";

      const existing_item = this.items.find(
        (existing) =>
          existing.item_code === new_item.item_code &&
          existing.uom === new_item.uom
      );

      if (existing_item) {
        existing_item.qty = flt(existing_item.qty) + flt(new_item.qty);
        existing_item.amount = this.calculateItemAmount(existing_item);
      } else {
        new_item.posa_row_id = this.generateRowId();
        new_item.posa_offers = "[]";
        new_item.posa_offer_applied = 0;
        new_item.posa_is_offer = 0;
        new_item.posa_is_replace = 0;
        new_item.is_free_item = 0;
        new_item.amount = this.calculateItemAmount(new_item);
        this.items.push(new_item);
      }

      // Update invoice_doc locally when items change
      this.updateInvoiceDocLocally();

      if (this.items.length === 1 && !this.invoice_doc?.name) {
        this.create_draft_invoice();
      } else {
        evntBus.emit("item_added", existing_item || new_item);
      }
    },

    updateInvoiceDocLocally() {
      // Update invoice_doc totals locally
      if (!this.invoice_doc) {
        this.invoice_doc = {};
      }

      // Use get_invoice_doc to get current data
      const doc = this.get_invoice_doc("auto");

      // Calculate totals locally
      this.calculateTotalsLocally(doc);

      // Update invoice_doc with calculated totals
      this.invoice_doc.total = doc.total;
      this.invoice_doc.total_qty = doc.total_qty;
      this.invoice_doc.posa_item_discount_total = doc.posa_item_discount_total;
      this.invoice_doc.discount_amount = doc.discount_amount;
      this.invoice_doc.net_total = doc.net_total;
      this.invoice_doc.total_taxes_and_charges = doc.total_taxes_and_charges;
      this.invoice_doc.grand_total = doc.grand_total;
      this.invoice_doc.rounded_total = doc.rounded_total;

      this.isUpdatingTotals = false;
    },
    generateRowId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    calculateItemAmount(item) {
      return flt(item.rate * item.qty, this.currency_precision);
    },

    calculateDiscountedPrice(item, discountPercent) {
      // Centralized price calculation matching backend formula
      const list_price = flt(item.price_list_rate) || 0;

      if (list_price <= 0) return list_price;

      if (discountPercent > 0) {
        const discount_amount = (list_price * discountPercent) / 100;
        return flt(list_price - discount_amount, this.currency_precision);
      }

      return list_price;
    },

    resetInvoiceState() {
      this.invoiceType = "Invoice";
      this.invoiceTypes = ["Invoice"];
      this.posting_date = frappe.datetime.nowdate();
      this.items = [];
      this.posa_offers = [];
      this.additional_discount_percentage = 0;
      evntBus.emit("update_invoice_type", this.invoiceType);
      // Clear invoice doc display in navbar
      evntBus.emit("update_invoice_doc", null);
    },

    hasValidPayments(invoice_doc = null) {
      const doc = invoice_doc || this.invoice_doc;
      const hasValid = doc?.payments?.some((p) => Math.abs(this.flt(p.amount)) > 0) || false;

      console.log("Invoice.js - hasValidPayments():", {
        hasValid: hasValid,
        payments: doc?.payments?.map(p => ({ mode: p.mode_of_payment, amount: p.amount })),
        is_return: doc?.is_return
      });

      return hasValid;
    },

    async create_draft_invoice() {
      // DISABLED: All operations stay __islocal - no auto-saving
      this.isUpdatingTotals = false;
      return null;
    },
    create_invoice(doc) {
      // DISABLED: All operations stay __islocal - no auto-saving
      return Promise.resolve(null);
    },

    async auto_update_invoice(doc = null, reason = "auto") {
      // DISABLED: All operations stay __islocal - no auto-saving
      return null;
    },

    queue_auto_save(reason = "auto") {
      if (this.invoice_doc?.submitted_for_payment) {
        return Promise.resolve();
      }

      // Skip auto-save if no items and no invoice doc
      if (this.items.length === 0 && !this.invoice_doc?.name) {
        return Promise.resolve();
      }

      // Simple: just send update immediately
      const doc = this.get_invoice_doc(reason);
      return this.auto_update_invoice(doc, reason);
    },

    async reload_invoice() {
      if (this.invoice_doc && this.invoice_doc?.name) {
        try {
          const result = await frappe.call({
            method: "frappe.client.get",
            args: {
              doctype: "Sales Invoice",
              name: this.invoice_doc?.name,
            },
          });

          if (result.message) {
            this.invoice_doc = result.message;
            if (result.message.items) {
              this.items = result.message.items;
            }
          }
        } catch (error) { }
      }
    },


    cancel_invoice() {
      // في نهج __islocal: لا نحتاج حذف من قاعدة البيانات
      // فقط إعادة تعيين الحالة وإغلاق نافذة الدفع
      this.reset_invoice_session();
      evntBus.emit("show_payment", "false");
    },

    reset_invoice_session() {
      this.resetInvoiceState();
      this.return_doc = null;
      this.invoice_doc = "";
      this.quick_return_value = false;
      this.invoiceType = "Invoice";
      this.invoiceTypes = ["Invoice"];

      // Reset all UI states
      evntBus.emit("set_customer_readonly", false);
      evntBus.emit("update_invoice_type", this.invoiceType);
      evntBus.emit("toggle_quick_return", false);
      evntBus.emit("update_invoice_doc", null);

      this.customer = this.pos_profile?.customer || this.customer;
      this._lastCustomer = null;  // Clear customer cache

      // Recalculate offers for new session with default customer
      this.calculateAndApplyOffers();
      // لا نرسل "new_invoice" event هنا لتفادي recursion
      // يتم إرساله من printInvoice() فقط بعد الطباعة الناجحة
    },

    new_invoice(data = {}) {
      evntBus.emit("set_customer_readonly", false);
      this.posa_offers = [];
      this.return_doc = "";

      // في نهج __islocal: لا نحفظ أي شيء قبل Print
      // previous invoice is automatically discarded

      if (!data.name && !data.is_return) {
        this.items = [];
        this.customer = this.pos_profile?.customer;
        this.invoice_doc = "";
        this.additional_discount_percentage = 0;
        this.invoiceType = "Invoice";
        this.invoiceTypes = ["Invoice"];
        evntBus.emit("update_invoice_type", this.invoiceType);
      } else {
        if (data.is_return) {
          evntBus.emit("set_customer_readonly", true);
          this.invoiceType = "Return";
          this.invoiceTypes = ["Return"];
          evntBus.emit("update_invoice_type", this.invoiceType);
        }
        this.invoice_doc = data;
        this.items = data.items || [];

        // Emit invoice_doc to Navbar for display
        evntBus.emit("update_invoice_doc", data);

        // Update items with POS-specific fields if needed
        this.items.forEach((item) => {
          if (!item.posa_row_id) {
            item.posa_row_id = this.makeid(20);
          }
        });


        this.posa_offers = (data.posa_offers || []).map(offer => ({
          ...offer,
          offer_applied: true
        }));
        this.items.forEach((item) => {
          item.base_rate = item.base_rate || item.price_list_rate;
          if (!item.posa_row_id) {
            item.posa_row_id = this.makeid(20);
          }
          if (item.batch_no) {
            this.set_batch_qty(item, item.batch_no);
          }
        });
        this.setCustomer(data.customer);
        this.posting_date = data.posting_date || frappe.datetime.nowdate();

        this.additional_discount_percentage =
          data.additional_discount_percentage;
        this.items.forEach((item) => {
          if (item.serial_no) {
            item.serial_no_selected = [];
            const serial_list = item.serial_no.split("\n");
            serial_list.forEach((element) => {
              if (element.length) {
                item.serial_no_selected.push(element);
              }
            });
            item.serial_no_selected_count = item.serial_no_selected.length;
          }
        });
      }
    },

    get_invoice_doc(reason = "auto") {
      const isPaymentFlow = reason === "payment" || reason === "print";
      const doc = {};

      // Always create a new invoice if no invoice exists or if we have items but no invoice name
      if (
        this.invoice_doc &&
        this.invoice_doc?.name &&
        !this.invoice_doc?.submitted_for_payment
      ) {
        doc.name = this.invoice_doc?.name;
      } else if (this.items.length > 0) {
        // Create new invoice when we have items but no existing invoice
      }
      doc.doctype = "Sales Invoice";
      doc.is_pos = 1;
      doc.ignore_pricing_rule = 1;
      doc.company = this.pos_profile?.company;
      doc.pos_profile = this.pos_profile?.name;
      doc.currency = this.pos_profile?.currency;
      doc.naming_series = this.pos_profile?.naming_series;
      doc.customer = this.customer;
      doc.posting_date = this.posting_date;
      doc.posa_pos_opening_shift = this.pos_opening_shift
        ? this.pos_opening_shift.name
        : null;

      doc.items = this.get_invoice_items_minimal();

      // Let ERPNext calculate discount_amount from additional_discount_percentage (standard behavior)
      doc.additional_discount_percentage = flt(
        this.additional_discount_percentage
      );
      doc.posa_offers = this.posa_offers;
      if (isPaymentFlow) {
        doc.payments = this.get_payments();
      }

      if (this.invoice_doc) {
        doc.is_return = this.invoice_doc?.is_return;
        doc.return_against = this.invoice_doc?.return_against;
      }

      return doc;
    },

    get_invoice_items_minimal() {
      return this.items.map((item) => {
        let qty = item.qty || 1;

        // For return invoices (Quick Return or Regular Return), quantity must be negative
        if (this.invoice_doc?.is_return || this.quick_return_value) {
          qty = -Math.abs(qty);
        }

        return {
          item_code: item.item_code,
          qty: qty,
          rate: item.rate || item.price_list_rate || 0,
          price_list_rate: item.price_list_rate || 0, // MUST send this so ERPNext can calculate discount_amount
          uom: item.uom || item.stock_uom,
          serial_no: item.serial_no,
          discount_percentage: item.discount_percentage || 0,
          // Don't send discount_amount - let ERPNext calculate it from price_list_rate + discount_percentage
          batch_no: item.batch_no,
        };
      });
    },

    get_payments() {
      let payments = [];

      // إذا كانت هناك مدفوعات موجودة في الفاتورة الحالية
      if (
        this.invoice_doc &&
        Array.isArray(this.invoice_doc?.payments) &&
        this.invoice_doc?.payments.length
      ) {
        payments = this.invoice_doc.payments.map((p) => ({
          amount: this.flt(p.amount),
          mode_of_payment: p.mode_of_payment,
          default: p.default,
          account: p.account || "",
          idx: p.idx,
        }));
      } else if (
        this.pos_profile &&
        Array.isArray(this.pos_profile?.payments)
      ) {
        let hasDefault = false;

        this.pos_profile?.payments.forEach((payment, index) => {
          if (payment.default) hasDefault = true;
          payments.push({
            amount: 0,
            mode_of_payment: payment.mode_of_payment,
            default: payment.default,
            account: payment.account || "",
            idx: index + 1,
          });
        });

        if (!hasDefault && payments.length > 0) payments[0].default = 1;
      }

      // --- إضافة معالجة التقريب ---
      const totalTarget = this.rounded_total || this.grand_total;
      let totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
      let diff = totalPayments - totalTarget;

      if (
        Math.abs(diff) >= 0.01 &&
        Math.abs(diff) <= 1.0 &&
        payments.length > 0
      ) {
        payments[0].amount = this.flt(payments[0].amount - diff);
      }

      return payments;
    },

    update_invoice(doc) {
      const vm = this;
      return new Promise((resolve, reject) => {
        // Ensure we have an invoice name for updates
        if (!doc.name) {
          reject(new Error("Invoice name required for updates"));
          return;
        }

        frappe.call({
          method: API_MAP.SALES_INVOICE.UPDATE,
          args: {
            data: doc,
          },
          async: true,
          callback: function (r) {
            if (r.message !== undefined) {
              if (r.message === null) {
                vm.invoice_doc = null;
                vm.items = [];
                resolve(null);
              } else {
                vm.invoice_doc = r.message;

                // Update posa_offers from backend response
                if (r.message.posa_offers) {
                  // Mark all offers from backend as applied since they are saved in the invoice
                  vm.posa_offers = r.message.posa_offers.map(offer => ({
                    ...offer,
                    offer_applied: true
                  }));

                  // Handle Transaction-level Percentage Discount Offers
                  let transactionDiscount = 0;
                  const appliedTransactionOffer = vm.posa_offers.find(
                    (offer) => offer.offer_applied
                  );

                  if (appliedTransactionOffer) {
                    transactionDiscount = flt(appliedTransactionOffer.discount_percentage);
                    vm.additional_discount_percentage = transactionDiscount;
                    // Store the origin of the discount
                    vm.offer_discount_percentage = transactionDiscount;


                  } else if (vm.offer_discount_percentage > 0) {
                    // If the offer was applied but is now removed, clear it.
                    vm.offer_discount_percentage = 0;
                  }


                  // Emit event for navbar to update invoice display
                  evntBus.emit("update_invoice_doc", vm.invoice_doc);

                  const appliedOffers = vm.posa_offers.filter(
                    (offer) => offer.offer_applied
                  );

                  if (appliedOffers.length > 0) {
                    evntBus.emit("update_pos_offers", appliedOffers);
                  }
                }

                resolve(vm.invoice_doc);
              }
            } else {
              reject(new Error("Failed to update invoice"));
            }
          },
          error: function (err) {
            if (
              err.message &&
              err.message.includes("Document has been modified")
            ) {
              vm.reload_invoice()
                .then(() => resolve(vm.invoice_doc))
                .catch((reloadError) => reject(reloadError));
            } else {
              reject(err);
            }
          },
        });
      });
    },

    async process_invoice() {
      // استخدام get_invoice_doc لبناء المستند الكامل
      const doc = this.get_invoice_doc("payment");

      // حساب الإجماليات محلياً
      this.calculateTotalsLocally(doc);

      // نسخ الإجماليات إلى invoice_doc للاحتفاظ بها
      if (!this.invoice_doc) {
        this.invoice_doc = {};
      }
      this.invoice_doc.total = doc.total;
      this.invoice_doc.total_qty = doc.total_qty;
      this.invoice_doc.posa_item_discount_total = doc.posa_item_discount_total;
      this.invoice_doc.discount_amount = doc.discount_amount;
      this.invoice_doc.net_total = doc.net_total;
      this.invoice_doc.grand_total = doc.grand_total;
      this.invoice_doc.rounded_total = doc.rounded_total;
      this.invoice_doc.items = doc.items;

      return doc;
    },

    async show_payment() {
      evntBus.emit("show_loading", { text: "Loading...", color: "info" });

      try {
        // التأكد من تحديث الإجماليات محلياً قبل فتح نافذة الدفع
        this.updateInvoiceDocLocally();

        const invoice_doc = await this.process_invoice();

        console.log("Invoice.js - show_payment() - invoice_doc:", {
          grand_total: invoice_doc?.grand_total,
          net_total: invoice_doc?.net_total,
          items_count: invoice_doc?.items?.length || 0,
          payments: invoice_doc?.payments?.length || 0,
          pos_profile_payments: this.pos_profile?.payments?.length || 0
        });

        // Add default payment method if no payments exist
        if (!invoice_doc?.payments || invoice_doc?.payments.length === 0) {
          // Adding default payment
          try {
            const defaultPayment = await frappe.call({
              method: API_MAP.POS_PROFILE.GET_DEFAULT_PAYMENT,
              args: {
                pos_profile: this.pos_profile?.name,
                company:
                  this.pos_profile?.company ||
                  frappe.defaults.get_user_default("Company"),
              },
            });

            if (defaultPayment.message) {
              invoice_doc.payments = [
                {
                  mode_of_payment: defaultPayment.message.mode_of_payment,
                  amount: flt(invoice_doc?.grand_total),
                  account: defaultPayment.message.account,
                  default: 1,
                },
              ];
              // Default payment added

              // في نهج __islocal: لا نحفظ على السيرفر
              // Payment stays local until Print
            }
          } catch (error) {
            // Payment get failed
          }
        }

        evntBus.emit("send_invoice_doc_payment", invoice_doc);
        evntBus.emit("show_payment", "true");

        this.posa_offers = [];

        if (this.pos_profile?.posa_clear_customer_after_payment) {
          this.setCustomer(this.pos_profile?.customer);
        }

        evntBus.emit("invoice_session_reset");
        evntBus.emit("hide_loading");
      } catch (error) {
        evntBus.emit("hide_loading");
        evntBus.emit("show_mesage", {
          text: "Error preparing invoice: " + error.message,
          color: "error",
        });
      }
    },

    open_returns() {
      if (!this.pos_profile?.posa_allow_return) return;

      evntBus.emit("open_returns", {
        pos_profile: this.pos_profile,
        pos_opening_shift: this.pos_opening_shift || null,
      });
    },

    close_payments() {
      evntBus.emit("show_payment", "false");
    },

    setCustomer(customer) {
      this.customer = customer;
      this.close_payments();
      evntBus.emit("set_customer", this.customer);
      if (this.invoice_doc) {
        this.invoice_doc.contact_person = "";
        this.invoice_doc.contact_email = "";
        this.invoice_doc.contact_mobile = "";
      }
      this.fetch_customer_details();
    },

    fetch_customer_details() {
      const vm = this;
      if (this.customer) {
        frappe.call({
          method: API_MAP.CUSTOMER.GET_CUSTOMER,
          args: {
            customer_id: vm.customer,
          },
          async: false,
          callback: (r) => {
            const message = r.message;
            if (!r.exc) {
              vm.customer_info = {
                ...message,
              };
              evntBus.emit("set_customer_info_to_edit", vm.customer_info);
            }
            vm.update_price_list();

            // ===== RECALCULATE OFFERS WITH CUSTOMER INFO =====
            vm.calculateAndApplyOffers();
          },
        });
      }
    },

    get_price_list() {
      let price_list = this.pos_profile?.selling_price_list;
      if (this.customer_info && this.pos_profile) {
        const { customer_price_list, customer_group_price_list } =
          this.customer_info;
        const pos_price_list = this.pos_profile?.selling_price_list;
        if (customer_price_list && customer_price_list != pos_price_list) {
          price_list = customer_price_list;
        } else if (
          customer_group_price_list &&
          customer_group_price_list != pos_price_list
        ) {
          price_list = customer_group_price_list;
        }
      }
      return price_list;
    },

    setDiscountPercentage(item, event) {

      let dis_percent = parseFloat(event.target.value) || 0;

      // Apply max discount limit
      const maxDiscount =
        this.pos_profile?.posa_item_max_discount_allowed || 100;

      if (dis_percent < 0) dis_percent = 0;
      if (dis_percent > maxDiscount) {
        dis_percent = maxDiscount;
        evntBus.emit("show_mesage", {
          text: `Maximum discount applied: ${maxDiscount}%`,
          color: "info",
        });
      }

      item.discount_percentage = dis_percent;

      // Use centralized price calculation
      item.rate = this.calculateDiscountedPrice(item, dis_percent);
      item.amount = this.calculateItemAmount(item);

    },

    setItemRate(item, event) {
      let dis_price = parseFloat(event.target.value) || 0;
      const list_price = flt(item.price_list_rate) || 0;

      if (dis_price < 0) dis_price = 0;

      // Don't allow dis_price higher than list_price
      if (dis_price > list_price) {
        dis_price = list_price;
        evntBus.emit("show_mesage", {
          text: "Price exceeds limit",
          color: "error",
        });
      }

      // Calculate dis_% from price difference
      let dis_percent = 0;
      if (list_price > 0) {
        dis_percent = ((list_price - dis_price) / list_price) * 100;
      }

      // Apply max discount limit
      const maxDiscount =
        this.pos_profile?.posa_item_max_discount_allowed || 100;

      if (dis_percent > maxDiscount) {
        // Adjust dis_price to respect max discount
        const max_dis_amount = (list_price * maxDiscount) / 100;
        dis_price = flt(list_price - max_dis_amount, this.currency_precision);
        dis_percent = maxDiscount;

        evntBus.emit("show_mesage", {
          text: `Maximum discount applied: ${maxDiscount}%`,
          color: "info",
        });
      }

      item.rate = dis_price;
      item.discount_percentage = flt(dis_percent, 2);
      item.amount = this.calculateItemAmount(item);

    },

    update_price_list() {
      let price_list = this.get_price_list();
      if (price_list == this.pos_profile?.selling_price_list) {
        price_list = null;
      }
      evntBus.emit("update_customer_price_list", price_list);
    },

    onDiscountInput(event) {
      // Only allow input if user has permission to edit additional discount
      if (!this.pos_profile?.posa_allow_user_to_edit_additional_discount) {
        return; // User not allowed to edit manually
      }
      // Handle input as user types - update the value immediately
      this.additional_discount_percentage = parseFloat(event.target.value) || 0;
    },

    onDiscountBlur() {
      // Validate and sync when focus leaves the field
      this.update_discount_umount();
    },

    update_discount_umount() {
      // Simplified: just validate and set, server will recalculate
      if (!this.pos_profile?.posa_allow_user_to_edit_additional_discount) {
        this.additional_discount_percentage =
          this.invoice_doc?.additional_discount_percentage || 0;
        return;
      }

      const value = flt(this.additional_discount_percentage) || 0;
      const maxDiscount =
        this.pos_profile?.posa_invoice_max_discount_allowed || 100;

      if (value < 0) {
        this.additional_discount_percentage = 0;
      } else if (value > maxDiscount) {
        this.additional_discount_percentage = maxDiscount;
        evntBus.emit("show_mesage", {
          text: `Maximum invoice discount is ${maxDiscount}%`,
          color: "info",
        });
      }

      // If user manually changes discount, clear offer tracking if values don't match
      // This indicates the discount is now manual, not from an offer
      if (this.offer_discount_percentage > 0 &&
          this.additional_discount_percentage !== this.offer_discount_percentage) {
        this.offer_discount_percentage = 0; // User changed it manually
      }

      // Update totals locally when discount changes
      this.updateInvoiceDocLocally();
    },

    set_serial_no(item) {
      if (!item.has_serial_no) return;
      item.serial_no = "";
      item.serial_no_selected.forEach((element) => {
        item.serial_no += element + "\n";
      });
      item.serial_no_selected_count = item.serial_no_selected.length;
      if (item.serial_no_selected_count != item.stock_qty) {
        item.qty = item.serial_no_selected_count;
        // Vue 3 reactive update - no need for $set
        this.$forceUpdate();
      }
    },

    set_batch_qty(item, value, update = true) {
      if (!item.batch_no_data || !Array.isArray(item.batch_no_data)) {
        return;
      }

      const vm = this;
      frappe.call({
        method: API_MAP.ITEM.PROCESS_BATCH_SELECTION,
        args: {
          item_code: item.item_code,
          current_item_row_id: item.posa_row_id,
          existing_items_data: this.items,
          batch_no_data: item.batch_no_data,
          preferred_batch_no: value || null,
        },
        async: false,
        callback: function (r) {
          if (r.message && r.message.success) {
            const result = r.message;
            const selectedBatch = result.selected_batch;

            item.batch_no = selectedBatch.batch_no;
            item.actual_batch_qty = selectedBatch.actual_batch_qty;
            item.batch_no_expiry_date = selectedBatch.expiry_date;
            item.batch_no_data = result.batch_data;

            if (selectedBatch.batch_price) {
              item.batch_price = selectedBatch.batch_price;
              item.price_list_rate = selectedBatch.batch_price;
              item.rate = selectedBatch.batch_price;
            } else if (update) {
              item.batch_price = null;
              vm.update_item_detail(item);
            }

            // Trigger reactivity without full re-render
            vm.$nextTick();
          } else {
            item.batch_no = null;
            item.actual_batch_qty = null;
            item.batch_no_expiry_date = null;
            item.batch_price = null;
            item.batch_no_data = r.message?.batch_data || [];

            if (r.message?.message) {
              evntBus.emit("show_mesage", {
                text: r.message.message,
                color: "warning",
              });
            }

            // Use nextTick instead of forceUpdate
            vm.$nextTick();
          }
        },
        error: function (err) {
          evntBus.emit("show_mesage", {
            text: "خطأ في اختيار الباتش: " + (err.message || "خطأ غير معروف"),
            color: "error",
          });
        },
      });
    },

    shortOpenPayment(e) {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.show_payment();
      }
    },

    shortDeleteFirstItem(e) {
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.remove_item(this.items[0]);
      }
    },

    shortOpenFirstItem(e) {
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.expanded = [];
        this.expanded.push(this.items[0]);
      }
    },

    shortSelectDiscount(e) {
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.$refs.discount.focus();
      }
    },

    makeid(length) {
      return crypto.randomUUID
        ? crypto.randomUUID().substring(0, length)
        : Math.random()
          .toString(36)
          .substring(2, 2 + length);
    },

    checkOfferIsAppley(item, offer) {

      let applied = false;

      // Handle null or undefined posa_offers
      if (!item.posa_offers) {
        return false;
      }

      try {
        const item_offers = JSON.parse(item.posa_offers);
        if (!Array.isArray(item_offers)) {
          return false;
        }

        for (const row_id of item_offers) {
          const exist_offer = this.posa_offers.find(
            (el) => row_id == el.row_id
          );
          if (exist_offer && exist_offer.offer_name == offer.name) {
            applied = true;
            break;
          }
        }
      } catch (error) {
        return false;
      }

      return applied;
    },

    mergeItemsFromAPI(apiItems) {
      // Preserve price_list_rate and other display fields when merging API response
      if (apiItems && Array.isArray(apiItems) && apiItems.length > 0) {
        // Create a simple map by item_code (since item_code never repeats in invoice)
        const localItemsByCode = new Map();

        this.items.forEach((item) => {
          localItemsByCode.set(item.item_code, item);
        });

        // Merge API items with local items, preserving price_list_rate
        this.items = apiItems.map((apiItem) => {
          // Find local item by item_code (simple & reliable)
          const localItem = localItemsByCode.get(apiItem.item_code);

          // If local item exists, preserve price_list_rate from it
          if (localItem?.price_list_rate && !apiItem.price_list_rate) {
            apiItem.price_list_rate = localItem.price_list_rate;
          }

          // Also preserve base_rate if needed
          if (localItem?.base_rate && !apiItem.base_rate) {
            apiItem.base_rate = localItem.base_rate;
          }

          // Preserve posa_row_id from local if API doesn't have it
          if (localItem?.posa_row_id && !apiItem.posa_row_id) {
            apiItem.posa_row_id = localItem.posa_row_id;
          }

          return apiItem;
        });
      }
    },


    sendInvoiceUpdate() {
      // DISABLED: No auto-saving - everything stays local
      this.isUpdatingTotals = false;
    },

    calculateTotalsLocally(doc) {
      // Calculate totals locally like ERPNext does
      if (!doc || !doc.items) return;

      // Calculate item totals
      let total = 0;
      let total_qty = 0;
      let item_discount_total = 0;

      doc.items.forEach(item => {
        const qty = flt(item.qty) || 0;
        const rate = flt(item.rate) || 0;
        const discount_percent = flt(item.discount_percentage) || 0;

        // Calculate discount amount
        const discount_amount = (rate * qty * discount_percent) / 100;
        item.discount_amount = discount_amount;
        item.amount = (rate * qty) - discount_amount;

        total += item.amount;
        total_qty += qty;
        item_discount_total += discount_amount;
      });

      // Set basic totals
      doc.total = total; // This is items_total
      doc.total_qty = total_qty;
      doc.posa_item_discount_total = item_discount_total;

      // Apply additional invoice discount
      const additional_discount = (total * flt(doc.additional_discount_percentage)) / 100;
      doc.discount_amount = additional_discount;

      // items_total after invoice discount
      const items_total_after_discount = total - additional_discount;

      // ===== TAX CALCULATION =====
      const applyTax = this.pos_profile?.posa_apply_tax;
      const taxType = this.pos_profile?.posa_tax_type;
      const taxPercent = flt(this.pos_profile?.posa_tax_percent) || 0;
      const normalizedTaxType = taxType?.replace('Tax ', '');

      if (applyTax && normalizedTaxType && (normalizedTaxType === 'Inclusive' || normalizedTaxType === 'Exclusive') && !isNaN(taxPercent) && taxPercent > 0) {

        if (normalizedTaxType === 'Inclusive') {
          // INCLUSIVE: prices already include tax
          // Example: items_total = 115, tax rate = 15%
          // grand_total = 115 (what customer pays - same as items_total)
          // net_total = 100 (base amount: 115 / 1.15)
          // tax = 15 (extracted: 115 - 100)

          doc.grand_total = items_total_after_discount;
          doc.net_total = items_total_after_discount / (1 + taxPercent / 100);
          doc.total_taxes_and_charges = items_total_after_discount - doc.net_total;

        } else {
          // EXCLUSIVE: prices don't include tax
          // Example: items_total = 100, tax rate = 15%
          // net_total = 100 (same as items_total)
          // tax = 15 (calculated: 100 × 0.15)
          // grand_total = 115 (items_total + tax)

          doc.net_total = items_total_after_discount;
          doc.total_taxes_and_charges = doc.net_total * (taxPercent / 100);
          doc.grand_total = doc.net_total + doc.total_taxes_and_charges;
        }

        // Apply precision formatting
        doc.total_taxes_and_charges = flt(doc.total_taxes_and_charges, this.currency_precision);
        doc.net_total = flt(doc.net_total, this.currency_precision);
        doc.grand_total = flt(doc.grand_total, this.currency_precision);

      } else {
        // No tax or invalid configuration
        doc.net_total = items_total_after_discount;
        doc.total_taxes_and_charges = 0;
        doc.grand_total = items_total_after_discount;
      }

      doc.rounded_total = Math.round(doc.grand_total * 2) / 2;
    },

    handleOffers() {
      if (this.invoice_doc?.name && this.items && this.items.length >= 1) {
        this._processOffers();
      }
    },

    _processOffers() {
      if (!this.invoice_doc?.name) return;

      // Skip processing if offers are already applied from backend response
      if (this.posa_offers && this.posa_offers.length > 0) {
        return;
      }

      // Check if offers are enabled in POS Profile (handle different value types)
      const offersEnabled = this.pos_profile?.posa_auto_fetch_offers !== 0 &&
        this.pos_profile?.posa_auto_fetch_offers !== "0" &&
        this.pos_profile?.posa_auto_fetch_offers !== false &&
        this.pos_profile?.posa_auto_fetch_offers !== null &&
        this.pos_profile?.posa_auto_fetch_offers !== undefined;

      if (!offersEnabled) {
        return; // Skip offers processing
      }

      // Skip offers processing if no items
      if (!this.items || this.items.length < 1) {
        return;
      }

      // Check cache first (cache for 30 seconds)
      const cacheKey = `${this.invoice_doc?.name}_${this.items.length}`;
      const now = Date.now();

      if (
        this._offersCache &&
        this._offersCache.key === cacheKey &&
        now - this._offersCache.timestamp < 30000
      ) {
        // Using cached offers
        this.updatePosOffers(this._offersCache.data);
        return;
      }

      // Prevent multiple simultaneous calls
      if (this._offersProcessing) {
        // Already processing offers
        return;
      }

      this._offersProcessing = true;

      frappe.call({
        method: API_MAP.POS_OFFER.GET_APPLICABLE_OFFERS,
        args: {
          invoice_name: this.invoice_doc?.name,
        },
        callback: (r) => {
          this._offersProcessing = false;

          if (r.message) {
            // Cache the results
            this._offersCache = {
              key: cacheKey,
              data: r.message,
              timestamp: now,
            };

            this.updatePosOffers(r.message);
          }
        },
        error: (r) => {
          this._offersProcessing = false;
        },
      });
    },

    getItemFromRowID(row_id) {
      const item = this.items.find((el) => el.posa_row_id == row_id);
      return item;
    },


    getItemOffer(offer) {
      // Deprecated: item-level offer processing is handled server-side automatically
      return null;
    },

    updatePosOffers(offers) {

      evntBus.emit("update_pos_offers", offers);
    },


    updateInvoiceOffers(offers) {
      // Normalize -> keep only valid offers; avoid { offer_name: null }
      const arr = Array.isArray(offers) ? offers : (offers ? [offers] : []);

      // If offers array is empty, force clear all offer discounts
      if (arr.length === 0) {
        // Clear transaction-level offer discounts
        if (this.additional_discount_percentage > 0 || this.offer_discount_percentage > 0) {
          this.additional_discount_percentage = 0;
          this.offer_discount_percentage = 0;
        }
        // Clear item-level offer discounts
        this.clearItemOfferDiscounts();
        this.posa_offers = [];
        this.updateInvoiceDocLocally();
        return; // Exit early
      }

      const cleaned = arr
        .filter(o => o && (o.offer_name || o.name || o.title))
        .map(o => {
          const name = (o.offer_name || o.name || '').toString().trim();
          const title = (o.title || '').toString().trim();
          const row_id = o.row_id; // keep if present for UI remove-by-row_id
          if (name) return { offer_name: name, row_id, offer_applied: true };
          return { title, row_id, offer_applied: true };
        });

      this.posa_offers = cleaned;           // backend reads posa_offers

      // ===== APPLY MANUALLY TOGGLED OFFERS =====
      this.applyManuallyToggledOffers(cleaned);
    },

    /**
     * Apply manually toggled offers from PosOffers component
     */
    applyManuallyToggledOffers(offers) {
      if (!offers || offers.length === 0) {
        return;
      }

      // Find transaction-level offers
      const transactionOffers = offers.filter(o =>
        ['grand_total', 'customer', 'customer_group', ''].includes(o.offer_type || '') &&
        o.discount_percentage
      );

      if (transactionOffers.length > 0) {
        // Sort by discount percentage (highest first)
        transactionOffers.sort((a, b) =>
          flt(b.discount_percentage) - flt(a.discount_percentage)
        );

        // Apply best transaction offer
        const bestOffer = transactionOffers[0];
        this.additional_discount_percentage = flt(bestOffer.discount_percentage);
        this.offer_discount_percentage = flt(bestOffer.discount_percentage);
      } else {
        // Clear if all transaction offers removed - check BOTH fields
        if (this.additional_discount_percentage > 0 || this.offer_discount_percentage > 0) {
          this.additional_discount_percentage = 0;
          this.offer_discount_percentage = 0;
        }
      }

      // Find item-level offers
      const itemOffers = offers.filter(o =>
        ['item_code', 'item_group', 'brand'].includes(o.offer_type) &&
        o.discount_percentage
      );

      // Apply item-level offers
      itemOffers.forEach(offer => {
        const discountPercent = flt(offer.discount_percentage);
        const offerName = offer.offer_name || offer.name;

        this.items.forEach(item => {
          let shouldApply = false;

          if (offer.offer_type === 'item_code' && item.item_code === offer.item_code) {
            shouldApply = true;
          } else if (offer.offer_type === 'item_group' && item.item_group === offer.item_group) {
            shouldApply = true;
          } else if (offer.offer_type === 'brand' && item.brand === offer.brand) {
            shouldApply = true;
          }

          // Allow reapplication if no offer applied OR if it's a different offer
          const canApply = shouldApply && (!item._offer_discount_applied || item._offer_name !== offerName);

          if (canApply) {
            // Store original discount before applying offer (for restoration when offer is removed)
            if (!item._original_discount_percentage) {
              item._original_discount_percentage = flt(item.discount_percentage || 0);
            }

            // Mark that this discount came from an offer
            item._offer_discount_applied = true;
            item._offer_name = offerName;

            item.discount_percentage = discountPercent;  // Apply as-is

            // Recalculate item price using centralized helper
            item.rate = this.calculateDiscountedPrice(item, discountPercent);
            item.amount = this.calculateItemAmount(item);
          }
        });
      });

      // Update totals
      this.updateInvoiceDocLocally();
    },

    /**
     * Apply offer to specific items (called from watchers)
     */
    applyItemOffer(offer) {
      const discountPercent = flt(offer.discount_percentage);
      const offerType = offer.offer_type;

      if (!discountPercent || !offerType) return;

      this.items.forEach(item => {
        let shouldApply = false;

        if (offerType === 'item_code' && item.item_code === offer.item_code) {
          shouldApply = true;
        } else if (offerType === 'item_group' && item.item_group === offer.item_group) {
          shouldApply = true;
        } else if (offerType === 'brand' && item.brand === offer.brand) {
          shouldApply = true;
        }

        // Allow reapplication if no offer applied OR if it's a different offer
        const offerName = offer.name || offer.offer_name;
        const canApply = shouldApply && (!item._offer_discount_applied || item._offer_name !== offerName);

        if (canApply) {
          // Store original discount before applying offer (for restoration when offer is removed)
          if (!item._original_discount_percentage) {
            item._original_discount_percentage = flt(item.discount_percentage || 0);
          }

          // Mark that this discount came from an offer
          item._offer_discount_applied = true;
          item._offer_name = offerName;

          item.discount_percentage = discountPercent;  // Apply as-is from offer

          // Recalculate item price using centralized helper
          item.rate = this.calculateDiscountedPrice(item, discountPercent);
          item.amount = this.calculateItemAmount(item);
        }
      });

      // Update totals
      this.updateInvoiceDocLocally();
    },


    removeApplyOffer(invoiceOffer) {

      const index = this.posa_offers.findIndex(
        (el) => el.row_id === invoiceOffer.row_id
      );
      if (index > -1) {
        this.posa_offers.splice(index, 1);
      }
    },

    applyNewOffer(offer) {

      const newOffer = {
        offer_name: offer.name,
        row_id: offer.row_id,
        apply_on: offer.apply_on,
        offer: offer.offer,
        items: JSON.stringify(offer.items),
        give_item: offer.give_item,
        give_item_row_id: offer.give_item_row_id,
        offer_applied: offer.offer_applied,
      };
      this.posa_offers.push(newOffer);
    },

    /**
     * Calculate and apply offers based on current invoice state
     * Called directly when items/customer change
     */
    calculateAndApplyOffers() {
      // Exit early if offers disabled
      if (!this.pos_profile?.posa_auto_fetch_offers) {
        return;
      }

      // Exit if no offers cached
      if (!this._sessionOffers || this._sessionOffers.length === 0) {
        return;
      }

      // Exit if no items
      if (!this.items || this.items.length === 0) {
        this.clearOfferDiscounts();
        return;
      }

      // Calculate totals
      const totalQty = this.items.reduce((sum, item) => sum + flt(item.qty || 0), 0);
      const totalAmount = this.items.reduce((sum, item) =>
        sum + (flt(item.qty || 0) * flt(item.rate || 0)), 0);

      // Filter applicable offers
      const applicableOffers = this._sessionOffers.filter(offer => {
        // Check date validity
        const today = frappe.datetime.nowdate();
        if (offer.valid_from && today < offer.valid_from) return false;
        if (offer.valid_upto && today > offer.valid_upto) return false;

        // Check qty thresholds
        if (offer.min_qty && totalQty < flt(offer.min_qty)) return false;
        if (offer.max_qty && totalQty > flt(offer.max_qty)) return false;

        // Check amount thresholds
        if (offer.min_amt && totalAmount < flt(offer.min_amt)) return false;
        if (offer.max_amt && totalAmount > flt(offer.max_amt)) return false;

        // Check customer match
        if (offer.offer_type === 'customer' && offer.customer !== this.customer) {
          return false;
        }

        // Check customer group match
        if (offer.offer_type === 'customer_group') {
          if (!this.customer_info?.customer_group ||
              this.customer_info.customer_group !== offer.customer_group) {
            return false;
          }
        }

        // Check item-specific applicability
        if (offer.offer_type === 'item_code') {
          return this.items.some(item => item.item_code === offer.item_code);
        }

        if (offer.offer_type === 'item_group') {
          return this.items.some(item => item.item_group === offer.item_group);
        }

        if (offer.offer_type === 'brand') {
          return this.items.some(item => item.brand === offer.brand);
        }

        return true; // General offer or grand_total offer
      });

      // Apply offers
      this.applyOffersToInvoice(applicableOffers);
    },

    /**
     * Apply filtered offers to invoice
     */
    applyOffersToInvoice(offers) {
      if (!offers || offers.length === 0) {
        this.clearOfferDiscounts();
        return;
      }

      // Sort by priority: auto offers first, then by discount percentage
      const sortedOffers = offers.sort((a, b) => {
        if (a.auto && !b.auto) return -1;
        if (!a.auto && b.auto) return 1;
        return flt(b.discount_percentage) - flt(a.discount_percentage);
      });

      // Apply transaction-level offer (only one allowed)
      const transactionOffer = sortedOffers.find(offer =>
        offer.auto &&
        offer.discount_percentage &&
        ['grand_total', 'customer', 'customer_group', ''].includes(offer.offer_type || '')
      );

      if (transactionOffer) {
        this.additional_discount_percentage = flt(transactionOffer.discount_percentage);
        this.offer_discount_percentage = flt(transactionOffer.discount_percentage);

        this.posa_offers = [{
          offer_name: transactionOffer.name,
          offer_type: transactionOffer.offer_type,
          discount_percentage: transactionOffer.discount_percentage,
          offer_applied: true,
          row_id: ''
        }];
      } else {
        this.clearOfferDiscounts();
      }

      // Apply item-level offers
      sortedOffers.forEach(offer => {
        if (!offer.auto || !offer.discount_percentage) return;

        const offerName = offer.offer_name || offer.name;

        this.items.forEach(item => {
          let shouldApply = false;

          if (offer.offer_type === 'item_code' && item.item_code === offer.item_code) {
            shouldApply = true;
          } else if (offer.offer_type === 'item_group' && item.item_group === offer.item_group) {
            shouldApply = true;
          } else if (offer.offer_type === 'brand' && item.brand === offer.brand) {
            shouldApply = true;
          }

          // Allow reapplication if no offer applied OR if it's a different offer
          const canApply = shouldApply && (!item._offer_discount_applied || item._offer_name !== offerName);

          if (canApply) {
            // Store original discount before applying offer (for restoration when offer is removed)
            if (!item._original_discount_percentage) {
              item._original_discount_percentage = flt(item.discount_percentage || 0);
            }

            // Mark that this discount came from an offer
            item._offer_discount_applied = true;
            item._offer_name = offerName;

            item.discount_percentage = flt(offer.discount_percentage);  // Apply as-is

            // Recalculate item price using centralized helper
            item.rate = this.calculateDiscountedPrice(item, flt(offer.discount_percentage));
            item.amount = this.calculateItemAmount(item);
          }
        });
      });

      // Update totals
      this.updateInvoiceDocLocally();
    },

    /**
     * Clear offer-based discounts
     */
    clearOfferDiscounts() {
      // Always clear both if either has a value - check BOTH fields
      if (this.additional_discount_percentage > 0 || this.offer_discount_percentage > 0) {
        this.additional_discount_percentage = 0;
        this.offer_discount_percentage = 0;
      }
      if (!this.posa_offers || this.posa_offers.length === 0) {
        this.posa_offers = [];
      }
    },

    /**
     * Clear item-level offer discounts and restore original values
     * @param {string|null} offerName - Specific offer to clear, or null to clear all
     */
    clearItemOfferDiscounts(offerName = null) {
      let itemsModified = false;

      this.items.forEach(item => {
        // Check if this item has an offer-applied discount
        if (item._offer_discount_applied) {
          // If specific offer name provided, only clear that offer
          if (offerName && item._offer_name !== offerName) {
            return; // Skip this item
          }

          // Restore original discount percentage
          const originalDiscount = flt(item._original_discount_percentage || 0);
          item.discount_percentage = originalDiscount;

          // Recalculate item price based on restored discount
          const list_price = flt(item.price_list_rate) || 0;
          if (list_price > 0) {
            if (originalDiscount > 0) {
              const discount_amount = (list_price * originalDiscount) / 100;
              item.rate = flt(list_price - discount_amount, this.currency_precision);
            } else {
              // No discount - restore to list price
              item.rate = list_price;
            }
            item.amount = this.calculateItemAmount(item);
          }

          // Clear offer tracking flags
          delete item._offer_discount_applied;
          delete item._offer_name;
          delete item._original_discount_percentage;

          itemsModified = true;
        }
      });

      // If any items were modified, recalculate invoice totals
      if (itemsModified) {
        this.updateInvoiceDocLocally();
      }

      return itemsModified;
    },

    printInvoice() {
      if (!this.invoice_doc) return;

      evntBus.emit("show_loading", { text: "Processing...", color: "info" });

      // Build invoice_doc locally as __islocal (ERPNext native approach)
      const doc = this.get_invoice_doc("print");
      doc.__islocal = 1;  // Mark as local document (matches ERPNext behavior)

      // Debug: Log important invoice data
      console.log("Invoice.js - printInvoice():", {
        customer: doc.customer,
        items_count: doc.items?.length || 0,
        grand_total: doc.grand_total,
        payment_count: doc.payments?.length || 0,
        is_return: doc.is_return
      });

      // Calculate totals locally (like ERPNext does)
      // This ensures totals are updated without saving to server
      this.calculateTotalsLocally(doc);

      console.log("Invoice.js - After calculateTotalsLocally():", {
        grand_total: doc.grand_total,
        net_total: doc.net_total,
        rounded_total: doc.rounded_total
      });

      if (!this.hasValidPayments(doc)) {
        console.log("Invoice.js - Payment validation failed");
        evntBus.emit("show_payment", "true");
        evntBus.emit("hide_loading");
        return;
      }

      // Send to server for insert + submit (ERPNext native workflow)
      console.log("Invoice.js - Sending to server for create_and_submit_invoice");
      frappe.call({
        method: "posawesome.posawesome.api.sales_invoice.create_and_submit_invoice",
        args: {
          invoice_doc: doc,
        },
        callback: (r) => {
          console.log("Invoice.js - Server response:", {
            success: !!r.message?.name,
            invoice_name: r.message?.name || "No name"
          });

          evntBus.emit("hide_loading");

          if (r.message?.name) {
            const print_format = this.pos_profile?.print_format;

            // Open print window directly
            const print_url = frappe.urllib.get_full_url(
              `/printview?doctype=Sales%20Invoice&name=${r.message.name}&format=${print_format}&trigger_print=1&no_letterhead=0`
            );

            window.open(print_url);

            evntBus.emit("set_last_invoice", r.message.name);
            evntBus.emit("show_mesage", {
              text: `Invoice ${r.message.name} submitted`,
              color: "success",
            });

            // إعادة تعيين الجلسة بعد الطباعة الناجحة (جميع الحالات: عادي، مرتجع، مرتجع سريع)
            this.reset_invoice_session();
            // إغلاق نافذة الدفع
            evntBus.emit("show_payment", "false");
            evntBus.emit("invoice_submitted");
          } else {
            console.error("Invoice.js - Submit failed: No invoice name returned");
            evntBus.emit("show_mesage", {
              text: "Submit failed",
              color: "error",
            });
          }
        },
        error: (err) => {
          console.error("Invoice.js - Server error:", err?.message || "Unknown error");
          evntBus.emit("hide_loading");
          evntBus.emit("show_mesage", {
            text: err?.message || "Failed to submit",
            color: "error",
          });
        },
      });
    },

    update_item_detail(item) {
      // Update item details from allItems data when customer changes
      if (!item || !item.item_code || !this.allItems) {
        return;
      }

      try {
        // Find updated item data from allItems
        const updatedItem = this.allItems.find(
          (allItem) => allItem.item_code === item.item_code
        );

        if (updatedItem) {
          // Update relevant fields while preserving POS-specific data
          const fieldsToUpdate = [
            "price_list_rate",
            "rate",
            "base_rate",
            "currency",
            "actual_qty",
            "item_name",
            "stock_uom",
            "item_group",
            "serial_no_data",
            "batch_no_data",
            "item_uoms",
          ];

          fieldsToUpdate.forEach((field) => {
            if (updatedItem.hasOwnProperty(field)) {
              item[field] = updatedItem[field];
            }
          });

          // Mark as detail synced to avoid repeated updates
          item._detailSynced = true;
        }
      } catch (error) {
        // Item detail update failed - continue with current data
      }
    },
  },

  created() {
    // Register event listeners in created() to avoid duplicate registrations

    evntBus.on("register_pos_profile", (data) => {
      this.pos_profile = data.pos_profile;
      this.setCustomer(data.pos_profile?.customer);
      this.pos_opening_shift = data.pos_opening_shift;
      this.stock_settings = data.stock_settings;
      this.float_precision =
        frappe.defaults.get_default("float_precision") || 2;
      this.currency_precision =
        frappe.defaults.get_default("currency_precision") || 2;
      this.invoiceType = "Invoice";
      evntBus.emit("update_invoice_type", this.invoiceType);
    });
    evntBus.on("add_item", (item) => {
      this.add_item(item);
    });
    evntBus.on("update_customer", (customer) => {
      this.setCustomer(customer);
      // Recalculate offers when customer changes
      if (this._lastCustomer !== customer) {
        this._lastCustomer = customer;
        this.calculateAndApplyOffers();
      }
    });
    evntBus.on("fetch_customer_details", () => {
      this.fetch_customer_details();
    });
    evntBus.on("new_invoice", () => {
      // في نهج __islocal: فقط إعادة تعيين الجلسة بدون حذف
      this.reset_invoice_session();
      evntBus.emit("show_payment", "false");
    });
    evntBus.on("load_invoice", (data) => {

      this.new_invoice(data);

      if (this.invoice_doc?.is_return) {
        this.additional_discount_percentage =
          -data.additional_discount_percentage;
        this.return_doc = data;
      } else {
        // Additional processing if needed
      }
    });

    evntBus.on("set_offers", (data) => {
      this.posOffers = data;
      // ===== CACHE SESSION OFFERS =====
      this._sessionOffers = data || [];
      // Recalculate when session offers are loaded/updated
      if (this.items && this.items.length > 0) {
        this.calculateAndApplyOffers();
      }
    });
    evntBus.on("update_invoice_offers", (data) => {
      this.updateInvoiceOffers(data);
    });
    evntBus.on("set_all_items", (data) => {
      this.allItems = data;
      this.items.forEach((item) => {
        this.update_item_detail(item);
      });
    });
    evntBus.on("load_return_invoice", (data) => {
      this.new_invoice(data.invoice_doc);

      // Handle return_doc data only if it exists (for returns against specific invoices)
      if (data.return_doc) {
        this.additional_discount_percentage =
          -data.return_doc.additional_discount_percentage || 0;
        this.return_doc = data.return_doc;
      } else {
        // Free return without reference invoice
        this.additional_discount_percentage = 0;
        this.return_doc = null;
      }

      // Force update to ensure computed properties are recalculated
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    });

    // Event-driven approach for items changes
    evntBus.on("item_added", (item) => {
      // Item added event
      this.calculateAndApplyOffers();
    });

    evntBus.on("item_removed", (item) => {
      // Item removed event
      this.calculateAndApplyOffers();
    });

    evntBus.on("item_updated", (item) => {
      // Item updated event
      this.calculateAndApplyOffers();
    });

    this.$nextTick(() => {
      // Component mounted
    });
    evntBus.on("send_invoice_doc_payment", (doc) => {
      this.invoice_doc = doc;
    });
    evntBus.on("payments_updated", (payments) => {
      if (this.invoice_doc) {
        this.invoice_doc.payments = payments || [];
        this.$forceUpdate();
      }
    });
    evntBus.on("request_invoice_print", () => {
      if (!this.canPrintInvoice()) {
        evntBus.emit("show_mesage", {
          text: "Please select a payment method before printing",
          color: "warning",
        });
        return;
      }
      this.printInvoice();
    });
  },
  mounted() {
    // DOM-related initialization (keyboard shortcuts)

    // Store bound function references so we can remove them later
    this._boundShortOpenPayment = this.shortOpenPayment.bind(this);
    this._boundShortDeleteFirstItem = this.shortDeleteFirstItem.bind(this);
    this._boundShortOpenFirstItem = this.shortOpenFirstItem.bind(this);
    this._boundShortSelectDiscount = this.shortSelectDiscount.bind(this);

    // Add event listeners with stored bound functions
    document.addEventListener("keydown", this._boundShortOpenPayment);
    document.addEventListener("keydown", this._boundShortDeleteFirstItem);
    document.addEventListener("keydown", this._boundShortOpenFirstItem);
    document.addEventListener("keydown", this._boundShortSelectDiscount);
  },
  beforeUnmount() {
    // Clean up ALL event listeners to prevent memory leaks

    // Clean up document event listeners using stored bound functions
    document.removeEventListener("keydown", this._boundShortOpenPayment);
    document.removeEventListener("keydown", this._boundShortDeleteFirstItem);
    document.removeEventListener("keydown", this._boundShortOpenFirstItem);
    document.removeEventListener("keydown", this._boundShortSelectDiscount);

    // Clean up event bus listeners
    evntBus.off("register_pos_profile");
    evntBus.off("add_item");
    evntBus.off("update_customer");
    evntBus.off("fetch_customer_details");
    evntBus.off("new_invoice");
    evntBus.off("load_invoice");
    evntBus.off("set_offers");
    evntBus.off("update_invoice_offers");
    evntBus.off("set_all_items");
    evntBus.off("load_return_invoice");
    evntBus.off("item_added");
    evntBus.off("item_removed");
    evntBus.off("item_updated");
    evntBus.off("send_invoice_doc_payment");
    evntBus.off("payments_updated");
    evntBus.off("request_invoice_print");

    // Clear ALL timers to prevent memory leaks
    if (this._itemOperationTimer) {
      clearTimeout(this._itemOperationTimer);
      this._itemOperationTimer = null;
    }
    if (this._autoUpdateTimer) {
      clearTimeout(this._autoUpdateTimer);
      this._autoUpdateTimer = null;
    }

    // Clear offer cache
    this._sessionOffers = [];
    this._lastCustomer = null;
  },
  // ===== SECTION 6: WATCH =====
  watch: {
    discount_amount() {
      // No auto-saving - everything stays local
    },
    offerApplied: {
      handler(newVal, oldVal) {
        if (!newVal) return;

        const offer = newVal;

        // Transaction-level offer (grand_total, customer, customer_group)
        if (offer.discount_percentage &&
            ['grand_total', 'customer', 'customer_group', ''].includes(offer.offer_type || '')) {

          // Update both discount fields
          this.additional_discount_percentage = parseFloat(offer.discount_percentage);
          this.offer_discount_percentage = parseFloat(offer.discount_percentage);

          // Trigger backend sync
          this.$nextTick(() => {
            this.update_discount_umount();
          });
          return;
        }

        // Item-level offer
        if (offer.offer_type &&
            ['item_code', 'item_group', 'brand'].includes(offer.offer_type) &&
            offer.discount_percentage) {

          this.applyItemOffer(offer);
          return;
        }

        // Other offer types or when reset to null
        if (newVal === null && oldVal !== null) {
          // Offer was reset to null (preparing for new application)
        }
      },
      deep: true,
      immediate: false
    },
    offerRemoved: {
      handler(removedOffer) {
        // Handle both boolean (legacy) and object (new) values
        if (!removedOffer || removedOffer === false) return;

        // If boolean true (all offers removed), clear everything
        if (removedOffer === true) {
          // Clear transaction-level discounts
          if (this.additional_discount_percentage > 0 || this.offer_discount_percentage > 0) {
            this.additional_discount_percentage = 0;
            this.offer_discount_percentage = 0;
          }
          // Clear all item discounts
          this.clearItemOfferDiscounts();

          // Recalculate totals
          this.$nextTick(() => {
            this.updateInvoiceDocLocally();
          });
          return;
        }

        // Handle specific offer removal (object)
        const offerType = removedOffer.offer_type || '';
        const offerName = removedOffer.name || removedOffer.offer_name;

        // Check if it's a transaction-level offer
        const isTransactionOffer = ['grand_total', 'customer', 'customer_group', ''].includes(offerType);

        // Check if it's an item-level offer
        const isItemOffer = ['item_code', 'item_group', 'brand'].includes(offerType);

        // Clear transaction-level discounts if it's a transaction offer
        if (isTransactionOffer) {
          // Always clear both if either has a value - check BOTH fields
          if (this.additional_discount_percentage > 0 || this.offer_discount_percentage > 0) {
            this.additional_discount_percentage = 0;
            this.offer_discount_percentage = 0;
          }
        }

        // Clear item-level discounts if it's an item offer
        if (isItemOffer) {
          this.clearItemOfferDiscounts(offerName);
        }

        // Fallback: If offer_type is missing but we have an offer name, try to clear it anyway
        // This handles cases where backend doesn't send offer_type properly
        if (!isTransactionOffer && !isItemOffer && offerName) {
          // Attempt to clear by name - if it was an item offer, this will work
          const itemsCleared = this.clearItemOfferDiscounts(offerName);

          // If no items were cleared, it might have been a transaction offer
          // Check if current discount matches the removed offer's discount
          if (!itemsCleared && removedOffer.discount_percentage) {
            const removedDiscount = flt(removedOffer.discount_percentage);
            if (this.additional_discount_percentage === removedDiscount ||
                this.offer_discount_percentage === removedDiscount) {
              this.additional_discount_percentage = 0;
              this.offer_discount_percentage = 0;
            }
          }
        }

        // Always recalculate totals after removing any offer
        this.$nextTick(() => {
          this.updateInvoiceDocLocally();
        });
      },
      immediate: false
    },
  },
};
