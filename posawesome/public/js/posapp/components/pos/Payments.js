// ===== SECTION 1: IMPORTS =====
import { evntBus } from "../../bus";
import format from "../../format";
import { API_MAP } from "../../api_mapper.js";

const EVENT_NAMES = {
  SHOW_PAYMENT: "show_payment",
  SET_CUSTOMER_READONLY: "set_customer_readonly",
  SHOW_MESSAGE: "show_mesage",
  SET_LAST_INVOICE: "set_last_invoice",
  NEW_INVOICE: "new_invoice",
  INVOICE_SUBMITTED: "invoice_submitted",
  PAYMENTS_UPDATED: "payments_updated",
  FREEZE: "freeze",
  UNFREEZE: "unfreeze",
  OPEN_EDIT_CUSTOMER: "open_edit_customer",
  OPEN_NEW_ADDRESS: "open_new_address",
  TOGGLE_QUICK_RETURN: "toggle_quick_return",
  SEND_INVOICE_DOC_PAYMENT: "send_invoice_doc_payment",
  REGISTER_POS_PROFILE: "register_pos_profile",
  ADD_THE_NEW_ADDRESS: "add_the_new_address",
  UPDATE_CUSTOMER: "update_customer",
  SET_POS_SETTINGS: "set_pos_settings",
  SET_CUSTOMER_INFO_TO_EDIT: "set_customer_info_to_edit",
  UPDATE_DUE_DATE: "update_due_date",
};

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
  mixins: [format],

  // ===== DATA =====
  data() {
    return {
      loading: false,
      pos_profile: "",
      invoice_doc: "",
      customer: "",
      loyalty_amount: 0,
      is_credit_sale: 0,
      is_write_off_change: 0,
      addresses: [],
      change_amount_rules: [],
      is_return: false,
      is_cashback: true,
      redeem_customer_credit: false,
      customer_credit_dict: [],
      phone_dialog: false,
      pos_settings: "",
      customer_info: "",
      quick_return: false,
      selected_return_payment_idx: null,
      set_full_amount_timeouts: {},
    };
  },

  // ===== COMPUTED =====
  computed: {
    // paid_amount: إجمالي المدفوعات (من جميع طرق الدفع)
    paid_amount() {
      let total = parseFloat(this.invoice_doc.loyalty_amount || 0);

      if (this.invoice_doc?.payments) {
        this.invoice_doc.payments.forEach((payment) => {
          total += this.flt(payment.amount || 0);
        });
      }

      total += this.flt(this.redeemed_customer_credit || 0);

      if (!this.is_cashback) total = 0;

      return this.flt(total, this.currency_precision);
    },

    // outstanding_amount: المبلغ المتأخر على الفاتورة (ما لم يُدفع بعد)
    outstanding_amount() {
      const target_amount =
        flt(this.invoice_doc.rounded_total) ||
        flt(this.invoice_doc.grand_total);
      const write_off_amount = flt(this.invoice_doc.write_off_amount || 0);

      // Following ERPNext logic: outstanding_amount = grand_total - paid_amount - write_off_amount
      const outstanding = this.flt(
        target_amount - this.paid_amount - write_off_amount,
        this.currency_precision
      );

      // Return only positive values (what's still owed)
      return outstanding > 0 ? outstanding : 0;
    },

    // change_amount: المبلغ المتبقي للعميل (الباقي إذا دفع أكثر من المطلوب)
    change_amount() {
      // Calculate paid_amount directly (not using computed property to avoid dependency issues)
      let paid_total = parseFloat(this.invoice_doc.loyalty_amount || 0);
      if (this.invoice_doc?.payments) {
        this.invoice_doc.payments.forEach((payment) => {
          paid_total += this.flt(payment.amount || 0);
        });
      }
      paid_total += this.flt(this.redeemed_customer_credit || 0);
      if (!this.is_cashback) paid_total = 0;
      paid_total = this.flt(paid_total, this.currency_precision);

      const target_amount =
        flt(this.invoice_doc.rounded_total) ||
        flt(this.invoice_doc.grand_total);
      const cash_mode = this.pos_profile?.posa_cash_mode_of_payment;

      console.log(
        "[Payments.js] change_amount computed - paid_total:",
        paid_total,
        "target_amount:",
        target_amount,
        "cash_mode:",
        cash_mode
      );

      // Only calculate change_amount if paid_total > grand_total
      if (paid_total > target_amount) {
        // If cash_mode is defined, verify that excess is from cash payment
        if (cash_mode) {
          const cash_payment = this.invoice_doc?.payments?.find(
            (p) => p.mode_of_payment === cash_mode
          );
          const other_payments_total =
            this.invoice_doc?.payments
              ?.filter((p) => p.mode_of_payment !== cash_mode)
              .reduce((sum, p) => sum + this.flt(p.amount || 0), 0) || 0;

          const other_totals = this.flt(
            (this.invoice_doc.loyalty_amount || 0) +
              (this.redeemed_customer_credit || 0) +
              other_payments_total,
            this.currency_precision
          );

          // Only allow excess if:
          // 1. Cash payment exists and has amount > 0
          // 2. Other payments (non-cash) don't exceed invoice total
          if (
            cash_payment &&
            this.flt(cash_payment.amount || 0) > 0 &&
            other_totals <= target_amount
          ) {
            // Following ERPNext: change_amount = paid_amount - grand_total (when paid_amount > grand_total)
            const change = this.flt(
              paid_total - target_amount,
              this.currency_precision
            );
            console.log(
              "[Payments.js] change_amount calculated:",
              change,
              "cash_payment:",
              cash_payment?.mode_of_payment,
              "cash_amount:",
              cash_payment?.amount,
              "other_totals:",
              other_totals,
              "target_amount:",
              target_amount
            );
            return change;
          } else {
            console.log(
              "[Payments.js] change_amount blocked - cash_payment:",
              cash_payment,
              "cash_amount:",
              cash_payment?.amount,
              "other_totals:",
              other_totals,
              "target_amount:",
              target_amount
            );
            return 0;
          }
        } else {
          // No cash_mode defined, but paid_total > grand_total
          // Allow change_amount calculation (for backward compatibility)
          const change = this.flt(
            paid_total - target_amount,
            this.currency_precision
          );
          console.log(
            "[Payments.js] change_amount calculated (no cash_mode):",
            change
          );
          return change;
        }
      }

      // No change amount (paid_total <= grand_total)
      console.log(
        "[Payments.js] change_amount = 0 (paid_total <= target_amount)"
      );
      return 0;
    },

    // Keep total_payments for backward compatibility
    total_payments() {
      return this.paid_amount;
    },

    // Keep diff_payment for backward compatibility (deprecated, use outstanding_amount and change_amount)
    diff_payment() {
      // Return outstanding_amount (positive) or negative change_amount
      if (this.change_amount > 0) {
        return -this.change_amount; // Negative to indicate excess
      }
      return this.outstanding_amount; // Positive to indicate remaining
    },

    available_pioints_amount() {
      if (!this.customer_info?.loyalty_points) return 0;
      return this.customer_info.loyalty_points;
    },

    available_customer_credit() {
      return this.customer_credit_dict.reduce(
        (total, row) => total + row.total_credit,
        0
      );
    },

    redeemed_customer_credit() {
      return this.customer_credit_dict.reduce((total, row) => {
        const credit = flt(row.credit_to_redeem);
        if (!credit) row.credit_to_redeem = 0;
        return total + credit;
      }, 0);
    },

    vaildatPayment() {
      return !this.invoice_doc || !this.invoice_doc.payments;
    },

    request_payment_field() {
      return (
        this.invoice_doc?.payments?.some(
          (payment) => payment.type === "Phone"
        ) || false
      );
    },
  },

  // ===== METHODS =====
  methods: {
    showMessage(text, color) {
      evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
    },

    emitPrintRequest() {
      this.$emit("request-print");
    },

    exposeSubmit(print = true, autoMode = false) {
      this.submit(undefined, autoMode, print);
    },

    autoPayWithDefault(invoice_doc) {
      this.invoice_doc = invoice_doc;
      const defaultPayment = this.getDefaultPayment();
      if (defaultPayment) {
        const total =
          this.flt(invoice_doc.rounded_total) ||
          this.flt(invoice_doc.grand_total);
        defaultPayment.amount = this.flt(total, this.currency_precision);
      }
      this.exposeSubmit(true, true);
    },

    getDefaultPayment() {
      const payments = Array.isArray(this.invoice_doc?.payments)
        ? this.invoice_doc.payments
        : [];
      return (
        payments.find((payment) => payment.default == 1) || payments[0] || null
      );
    },

    back_to_invoice() {
      evntBus.emit(EVENT_NAMES.SHOW_PAYMENT, "false");
      evntBus.emit(EVENT_NAMES.SET_CUSTOMER_READONLY, false);
    },

    async submit(event, autoMode = false, print = false) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      try {
        await this.refreshInvoiceDoc();
      } catch (error) {
        console.log("[Payments.js] submit error:", error);
      }

      if (this.invoice_doc?.docstatus === 1) {
        if (print) {
          this.load_print_page();
        }
        evntBus.emit(EVENT_NAMES.SET_LAST_INVOICE, this.invoice_doc.name);
        evntBus.emit(EVENT_NAMES.NEW_INVOICE, "false");
        this.back_to_invoice();
        return;
      }

      if (autoMode) {
        const defaultPayment = this.getDefaultPayment();
        if (!defaultPayment) {
          this.showMessage("No default payment method in POS profile", "error");
          return;
        }
        const total =
          this.flt(this.invoice_doc.rounded_total) ||
          this.flt(this.invoice_doc.grand_total);
        defaultPayment.amount = this.flt(total, this.currency_precision);
      }

      this.submit_invoice(print, autoMode);
    },

    submit_invoice(print, autoMode, retrying = false) {
      if (this.quick_return) {
        this.invoice_doc.is_return = 1;

        let total = 0;
        this.invoice_doc.items.forEach((item) => {
          item.qty = -1 * Math.abs(item.qty);
          item.stock_qty = -1 * Math.abs(item.stock_qty || item.qty);
          item.amount = -1 * Math.abs(item.amount);
          item.net_amount = -1 * Math.abs(item.net_amount || item.amount);
          total += item.amount;
        });

        this.invoice_doc.total = total;
        this.invoice_doc.net_total = total;
        this.invoice_doc.grand_total = total;
        this.invoice_doc.rounded_total = total;
        this.invoice_doc.base_total = total;
        this.invoice_doc.base_net_total = total;
        this.invoice_doc.base_grand_total = total;

        if (typeof this.selected_return_payment_idx === "number") {
          this.invoice_doc.payments.forEach((payment) => {
            payment.amount =
              payment.idx === this.selected_return_payment_idx ? total : 0;
          });
        } else {
          if (this.invoice_doc.payments?.length > 0) {
            this.invoice_doc.payments[0].amount = total;
          }
        }

        this.quick_return = false;
      }

      let totalPayedAmount = 0;
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = flt(payment.amount);
        totalPayedAmount += payment.amount;
      });

      const targetAmount =
        flt(this.invoice_doc.rounded_total) ||
        flt(this.invoice_doc.grand_total);

      // Include loyalty and customer credit in total
      const allPaymentsTotal = this.flt(
        totalPayedAmount +
          (this.invoice_doc.loyalty_amount || 0) +
          (this.redeemed_customer_credit || 0),
        this.currency_precision
      );

      // Allow excess payment only if it's from cash mode
      const cash_mode = this.pos_profile?.posa_cash_mode_of_payment;
      const cash_payment = this.invoice_doc.payments?.find(
        (p) => p.mode_of_payment === cash_mode
      );

      // If payment exceeds invoice total, check if excess is from cash
      if (allPaymentsTotal > targetAmount) {
        if (
          !cash_mode ||
          !cash_payment ||
          this.flt(cash_payment.amount || 0) <= 0
        ) {
          this.showMessage(
            "المبلغ الزائد مسموح فقط لطريقة الدفع النقدي",
            "error"
          );
          return;
        }

        // Check if excess is only from cash payment
        const other_payments =
          this.invoice_doc.payments
            ?.filter((p) => p.mode_of_payment !== cash_mode)
            .reduce((sum, p) => sum + this.flt(p.amount || 0), 0) || 0;

        const other_totals = this.flt(
          (this.invoice_doc.loyalty_amount || 0) +
            (this.redeemed_customer_credit || 0) +
            other_payments,
          this.currency_precision
        );

        if (other_totals > targetAmount) {
          this.showMessage(
            "المبلغ الزائد مسموح فقط لطريقة الدفع النقدي",
            "error"
          );
          return;
        }
      } else {
        // Normal case: payment is less than or equal to invoice total
        const difference = Math.abs(allPaymentsTotal - targetAmount);
        if (difference > 0.05) {
          this.showMessage(
            `Payment mismatch: Total ${allPaymentsTotal} vs Target ${targetAmount}`,
            "error"
          );
          return;
        }
      }

      if (this.invoice_doc.is_return && totalPayedAmount == 0) {
        this.invoice_doc.is_pos = 0;
      }

      if (this.customer_credit_dict.length) {
        this.customer_credit_dict.forEach((row) => {
          row.credit_to_redeem = flt(row.credit_to_redeem);
        });
      }

      // Calculate paid_amount following ERPNext's set_paid_amount() logic
      // This matches ERPNext's calculation: sum of all payments.amount
      let paid_amount = 0.0;
      if (this.invoice_doc?.payments) {
        this.invoice_doc.payments.forEach((payment) => {
          paid_amount += flt(payment.amount || 0);
        });
      }
      paid_amount += flt(this.invoice_doc.loyalty_amount || 0);
      paid_amount += flt(this.redeemed_customer_credit || 0);

      // Set paid_amount in invoice_doc (ERPNext field name)
      this.invoice_doc.paid_amount = flt(paid_amount, this.currency_precision);

      // Calculate change_amount following ERPNext's calculate_change_amount() logic
      // change_amount = paid_amount - grand_total (when paid_amount > grand_total and has Cash payment)
      const grand_total =
        flt(this.invoice_doc.rounded_total) ||
        flt(this.invoice_doc.grand_total);

      // Check if there's a Cash payment (following ERPNext logic)
      const has_cash_payment =
        this.invoice_doc?.payments?.some((p) => p.type === "Cash") || false;

      const calculated_change_amount =
        !this.invoice_doc.is_return &&
        paid_amount > grand_total &&
        has_cash_payment
          ? flt(paid_amount - grand_total, this.currency_precision)
          : 0.0;

      // Set change_amount in invoice_doc (ERPNext field name)
      this.invoice_doc.change_amount = calculated_change_amount;

      const data = {
        redeemed_customer_credit: this.redeemed_customer_credit,
        customer_credit_dict: this.customer_credit_dict,
        is_cashback: this.is_cashback,
      };

      if (autoMode) {
        this.load_print_page();
        evntBus.emit(EVENT_NAMES.NEW_INVOICE, "false");
        this.back_to_invoice();
        return;
      }

      frappe.call({
        method: API_MAP.SALES_INVOICE.SUBMIT,
        args: {
          data: data,
          invoice: {
            name: this.invoice_doc.name,
            customer: this.invoice_doc.customer,
            is_return: this.invoice_doc.is_return,
            is_pos: this.invoice_doc.is_pos,
            payments: this.invoice_doc.payments,
            loyalty_amount: this.invoice_doc.loyalty_amount,
            redeem_loyalty_points: this.invoice_doc.redeem_loyalty_points,
            loyalty_points: this.invoice_doc.loyalty_points,
            write_off_amount: this.invoice_doc.write_off_amount,
            write_off_outstanding_amount_automatically:
              this.invoice_doc.write_off_outstanding_amount_automatically,
            contact_mobile: this.invoice_doc.contact_mobile,
            contact_person: this.invoice_doc.contact_person,
            contact_email: this.invoice_doc.contact_email,
            due_date: this.invoice_doc.due_date,
            delivery_date: this.invoice_doc.delivery_date,
            address_display: this.invoice_doc.address_display,
            shipping_address_name: this.invoice_doc.shipping_address_name,
            customer_address: this.invoice_doc.customer_address,
            shipping_address: this.invoice_doc.shipping_address,
          },
        },
        async: true,
        callback: (r) => {
          if (r.message) {
            if (print) {
              this.load_print_page();
            }
            evntBus.emit(EVENT_NAMES.SET_LAST_INVOICE, this.invoice_doc.name);
            this.addresses = [];
            evntBus.emit(EVENT_NAMES.NEW_INVOICE, "false");
            evntBus.emit(EVENT_NAMES.INVOICE_SUBMITTED);
            this.back_to_invoice();
          } else {
            this.showMessage("Failed to submit invoice", "error");
          }
        },
        error: (err) => {
          const errorMsg = err?.message || "";
          const isTimestampError =
            typeof errorMsg === "string" &&
            errorMsg.includes("Document has been modified");

          if (!retrying && isTimestampError) {
            this.refreshInvoiceDoc()
              .then(() => {
                this.submit_invoice(print, autoMode, true);
              })
              .catch((err) => {
                console.log(
                  "[Payments.js] refreshInvoiceDoc catch error:",
                  err
                );
                this.showMessage(
                  "Invoice was modified elsewhere, please try again",
                  "warning"
                );
              });
            return;
          }

          this.showMessage(err?.message || "Failed to submit invoice", "error");
        },
      });
    },

    refreshInvoiceDoc() {
      if (!this.invoice_doc?.name) {
        return Promise.resolve();
      }

      const shouldMergeLocalPayments = this.invoice_doc.docstatus === 0;
      const localPayments =
        shouldMergeLocalPayments && this.invoice_doc.payments
          ? this.invoice_doc.payments.map((payment) => ({ ...payment }))
          : [];

      return new Promise((resolve, reject) => {
        frappe.call({
          method: API_MAP.FRAPPE.CLIENT_GET,
          args: {
            doctype: "Sales Invoice",
            name: this.invoice_doc.name,
          },
          async: true,
          callback: (res) => {
            if (res.message) {
              const freshDoc = res.message;

              if (shouldMergeLocalPayments && freshDoc.docstatus === 0) {
                const mergedPayments = (freshDoc.payments || []).map(
                  (payment) => {
                    const localMatch = localPayments.find((localPayment) => {
                      if (
                        localPayment.idx !== undefined &&
                        payment.idx !== undefined
                      ) {
                        return payment.idx === localPayment.idx;
                      }
                      return (
                        payment.mode_of_payment === localPayment.mode_of_payment
                      );
                    });

                    return localMatch
                      ? { ...payment, amount: localMatch.amount }
                      : payment;
                  }
                );

                const seen = new Set(
                  mergedPayments.map(
                    (payment) =>
                      `${payment.mode_of_payment || ""}__${payment.idx || ""}`
                  )
                );

                localPayments.forEach((localPayment) => {
                  const key = `${localPayment.mode_of_payment || ""}__${
                    localPayment.idx || ""
                  }`;
                  if (!seen.has(key) && flt(localPayment.amount)) {
                    mergedPayments.push(localPayment);
                  }
                });

                freshDoc.payments = mergedPayments;
              }

              this.invoice_doc = freshDoc;
              resolve();
            } else {
              reject(new Error("Failed to refresh invoice"));
            }
          },
          error: (err) => reject(err),
        });
      });
    },

    set_full_amount(idx) {
      try {
        // Clear any pending timeout for this specific payment
        if (this.set_full_amount_timeouts[idx]) {
          clearTimeout(this.set_full_amount_timeouts[idx]);
          delete this.set_full_amount_timeouts[idx];
        }

        // Debounce to prevent multiple rapid calls for the same payment
        this.set_full_amount_timeouts[idx] = setTimeout(() => {
          const isReturn = !!this.invoice_doc.is_return;

          const payment = this.invoice_doc.payments.find((p) => p.idx == idx);
          if (!payment) {
            delete this.set_full_amount_timeouts[idx];
            return;
          }

          // Clear all other payment methods first
          this.invoice_doc.payments.forEach((p) => {
            if (p.idx !== idx) {
              p.amount = 0;
              if (p.base_amount !== undefined) {
                p.base_amount = 0;
              }
            }
          });

          // Calculate invoice total
          const invoice_total =
            flt(this.invoice_doc.rounded_total) ||
            flt(this.invoice_doc.grand_total);

          // Fill with full invoice amount when clicking the payment method button
          const amount = this.flt(invoice_total, this.currency_precision);
          const target_amount = isReturn ? -Math.abs(amount) : amount;

          payment.amount = target_amount;
          if (payment.base_amount !== undefined) {
            payment.base_amount = payment.amount;
          }

          // Trigger validation after setting amount
          this.$nextTick(() => {
            this.validate_payment_amount(payment);
          });

          evntBus.emit(
            EVENT_NAMES.PAYMENTS_UPDATED,
            JSON.parse(JSON.stringify(this.invoice_doc.payments))
          );

          // Force update to recalculate computed properties
          this.$nextTick(() => {
            this.$forceUpdate();
          });

          console.log(
            "[Payments.js] set_full_amount: idx:",
            idx,
            "mode_of_payment:",
            payment.mode_of_payment,
            "amount:",
            amount
          );

          // Log payment summary
          console.log(
            "[Payments.js] Payment Summary - paid_amount (إجمالي المدفوعات):",
            this.paid_amount,
            "outstanding_amount (المبلغ المتأخر):",
            this.outstanding_amount,
            "change_amount (المتبقي للعميل):",
            this.change_amount,
            "إجمالي الفاتورة:",
            invoice_total
          );

          delete this.set_full_amount_timeouts[idx];
        }, 150); // 150ms debounce per payment
      } catch (error) {
        console.log("[Payments.js] set_full_amount error:", error);
        if (this.set_full_amount_timeouts[idx]) {
          delete this.set_full_amount_timeouts[idx];
        }
      }
    },

    set_rest_amount(idx) {
      try {
        const isReturn = !!this.invoice_doc.is_return;
        const invoice_total =
          flt(this.invoice_doc.rounded_total) ||
          flt(this.invoice_doc.grand_total);

        const payment = this.invoice_doc.payments.find((p) => p.idx === idx);
        if (!payment) return;

        // Calculate current total payments excluding this payment
        const other_payments =
          this.invoice_doc.payments
            ?.filter((p) => p.idx !== idx)
            .reduce((sum, p) => sum + this.flt(p.amount || 0), 0) || 0;

        const other_totals = this.flt(
          (this.invoice_doc.loyalty_amount || 0) +
            (this.redeemed_customer_credit || 0) +
            other_payments,
          this.currency_precision
        );

        // Calculate remaining amount
        const remaining = this.flt(
          invoice_total - other_totals,
          this.currency_precision
        );

        // Fill with remaining amount (cannot exceed invoice total for non-cash)
        const cash_mode = this.pos_profile?.posa_cash_mode_of_payment;
        let amount = remaining;

        // For non-cash payments, limit to remaining amount (cannot exceed invoice total)
        if (cash_mode && payment.mode_of_payment !== cash_mode) {
          // Non-cash: fill with remaining amount, but not more than invoice total
          amount = remaining > 0 ? remaining : 0;
        } else {
          // Cash payment: can fill with remaining amount (can exceed later if needed)
          amount = remaining;
        }

        payment.amount = isReturn ? -Math.abs(amount) : amount;
        if (payment.base_amount !== undefined) {
          payment.base_amount = payment.amount;
        }

        evntBus.emit(
          EVENT_NAMES.PAYMENTS_UPDATED,
          JSON.parse(JSON.stringify(this.invoice_doc.payments))
        );

        console.log(
          "[Payments.js] set_rest_amount: idx:",
          idx,
          "mode_of_payment:",
          payment.mode_of_payment,
          "remaining:",
          remaining,
          "amount:",
          amount
        );

        // Force update to recalculate computed properties
        this.$nextTick(() => {
          this.$forceUpdate();
        });

        // Log payment summary
        console.log(
          "[Payments.js] Payment Summary - paid_amount (إجمالي المدفوعات):",
          this.paid_amount,
          "outstanding_amount (المبلغ المتأخر):",
          this.outstanding_amount,
          "change_amount (المتبقي للعميل):",
          this.change_amount,
          "إجمالي الفاتورة:",
          invoice_total
        );
      } catch (error) {
        console.log("[Payments.js] set_rest_amount error:", error);
      }
    },

    clear_all_amounts() {
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = 0;
      });
    },

    load_print_page() {
      const print_format =
        this.pos_profile.print_format_for_online ||
        this.pos_profile.posa_print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url = `${frappe.urllib.get_base_url()}/printview?doctype=Sales%20Invoice&name=${
        this.invoice_doc.name
      }&trigger_print=1&format=${print_format}&no_letterhead=${letter_head}`;

      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        },
        true
      );
    },

    validate_due_date() {
      const today = frappe.datetime.now_date();
      const parse_today = Date.parse(today);
      const new_date = Date.parse(this.invoice_doc.due_date);

      if (new_date < parse_today) {
        setTimeout(() => {
          this.invoice_doc.due_date = today;
        }, 0);
      }
    },

    shortPay(e) {
      if (e.key === "x" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.submit();
      }
    },

    set_change_amount() {
      // Following ERPNext logic: change_amount is calculated automatically
      // change_amount = paid_amount - grand_total (when paid_amount > grand_total)
      // This method is kept for compatibility but change_amount is now a computed property
      this.change_amount_rules = [];
    },

    validate_payment_amount(payment) {
      // Check if payment amount exceeds invoice total for non-cash payments
      const target_amount =
        flt(this.invoice_doc.rounded_total) ||
        flt(this.invoice_doc.grand_total);
      const payment_amount = this.flt(payment.amount || 0);
      const cash_mode = this.pos_profile?.posa_cash_mode_of_payment;

      // Log payment change
      console.log(
        "[Payments.js] Payment Input Changed - idx:",
        payment.idx,
        "mode_of_payment:",
        payment.mode_of_payment,
        "amount:",
        payment_amount
      );

      // Calculate change_amount manually to ensure it's calculated
      const paid_total = this.paid_amount;
      const change_amt =
        paid_total > target_amount ? paid_total - target_amount : 0;

      // Force update to recalculate computed properties
      this.$nextTick(() => {
        this.$forceUpdate();
      });

      // Log payment summary
      console.log(
        "[Payments.js] Payment Summary - paid_amount (إجمالي المدفوعات):",
        this.paid_amount,
        "outstanding_amount (المبلغ المتأخر):",
        this.outstanding_amount,
        "change_amount (المتبقي للعميل):",
        this.change_amount,
        "change_amount (manual):",
        change_amt,
        "إجمالي الفاتورة:",
        target_amount
      );

      // For non-cash payments, check if amount exceeds invoice total
      if (cash_mode && payment.mode_of_payment !== cash_mode) {
        // Non-cash payment: cannot exceed invoice total
        if (payment_amount > target_amount) {
          // Reset to invoice total
          payment.amount = target_amount;
          if (payment.base_amount !== undefined) {
            payment.base_amount = payment.amount;
          }
          this.showMessage(
            `لا يمكن إدخال مبلغ أعلى من إجمالي الفاتورة (${this.formatCurrency(
              target_amount
            )})`,
            "error"
          );
          evntBus.emit(
            EVENT_NAMES.PAYMENTS_UPDATED,
            JSON.parse(JSON.stringify(this.invoice_doc.payments))
          );
          return false;
        }
      }

      // For cash payment, allow excess (no validation needed)
      return true;
    },

    get_available_credit(e) {
      this.clear_all_amounts();

      if (!e) {
        this.customer_credit_dict = [];
        return;
      }

      frappe.call({
        method: API_MAP.CUSTOMER.GET_CUSTOMER_CREDIT,
        args: {
          customer_id: this.invoice_doc.customer,
          company: this.pos_profile.company,
        },
        callback: (r) => {
          const data = r.message;

          if (!data?.length) {
            this.customer_credit_dict = [];
            return;
          }

          const amount = this.invoice_doc.grand_total;
          let remainAmount = amount;

          data.forEach((row) => {
            if (remainAmount > 0) {
              row.credit_to_redeem =
                remainAmount >= row.total_credit
                  ? row.total_credit
                  : remainAmount;
              remainAmount -= row.credit_to_redeem;
            } else {
              row.credit_to_redeem = 0;
            }
          });

          this.customer_credit_dict = data;
        },
      });
    },

    get_addresses() {
      const customer = this.invoice_doc?.customer || this.customer;

      if (!customer) {
        this.addresses = [];
        return;
      }

      frappe.call({
        method: API_MAP.CUSTOMER.GET_ADDRESSES,
        args: { customer_id: customer },
        async: true,
        callback: (r) => {
          this.addresses = r.exc ? [] : r.message;
        },
      });
    },

    addressFilter(item, queryText) {
      const searchText = queryText.toLowerCase();
      const fields = [
        item.address_title,
        item.address_line1,
        item.address_line2,
        item.city,
        item.name,
      ];

      return fields.some((field) => field?.toLowerCase().includes(searchText));
    },

    // Open dialog to create new address
    new_address() {
      evntBus.emit(EVENT_NAMES.OPEN_NEW_ADDRESS, this.invoice_doc.customer);
    },

    //  Request payment (disabled feature)
    request_payment() {
      this.phone_dialog = false;

      if (!this.invoice_doc.contact_mobile) {
        this.showMessage("Please enter customer phone number", "error");
        evntBus.emit(EVENT_NAMES.OPEN_EDIT_CUSTOMER);
        this.back_to_invoice();
        return;
      }

      evntBus.emit(EVENT_NAMES.FREEZE, { title: "Please wait for payment..." });

      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = flt(payment.amount);
      });

      evntBus.emit(EVENT_NAMES.UNFREEZE);
    },
  },

  // ===== LIFECYCLE HOOKS =====
  mounted() {
    this.$nextTick(() => {
      evntBus.on(EVENT_NAMES.TOGGLE_QUICK_RETURN, (value) => {
        this.quick_return = value;
      });

      evntBus.on(EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT, (invoice_doc) => {
        // DEBUG: Log received invoice totals
        console.log(
          "[Payments.js] SEND_INVOICE_DOC_PAYMENT: rounded_total:",
          invoice_doc.rounded_total,
          "grand_total:",
          invoice_doc.grand_total
        );

        this.invoice_doc = invoice_doc;

        if (!Array.isArray(this.invoice_doc.payments)) {
          this.showMessage("No payments array in invoice document", "error");
          this.invoice_doc.payments = [];
        } else {
          this.invoice_doc.payments.forEach((payment, index) => {
            if (!payment.idx) payment.idx = index + 1;
          });
        }

        const default_payment = this.invoice_doc.payments.find(
          (payment) => payment.default == 1
        );
        this.is_credit_sale = 0;
        this.is_write_off_change = 0;

        if (default_payment && !invoice_doc.is_return) {
          const total =
            this.flt(invoice_doc.rounded_total) ||
            this.flt(invoice_doc.grand_total);
          default_payment.amount = this.flt(total, this.currency_precision);
        }

        if (invoice_doc.is_return) {
          this.is_return = true;
          const total = invoice_doc.rounded_total || invoice_doc.grand_total;

          invoice_doc.payments.forEach((payment) => {
            payment.amount = 0;
            if (payment.base_amount !== undefined) payment.base_amount = 0;
          });

          if (default_payment) {
            const neg = -Math.abs(total);
            default_payment.amount = neg;
            if (default_payment.base_amount !== undefined)
              default_payment.base_amount = neg;
          }
        }

        this.loyalty_amount = 0;
        this.get_addresses();
      });

      evntBus.on(EVENT_NAMES.REGISTER_POS_PROFILE, (data) => {
        this.pos_profile = data.pos_profile;
        if (data.pos_profile?.customer) {
          this.customer = data.pos_profile.customer;
          this.get_addresses();
        }
      });

      evntBus.on(EVENT_NAMES.ADD_THE_NEW_ADDRESS, (data) => {
        this.addresses.push(data);
        this.$forceUpdate();
      });
    });

    evntBus.on(EVENT_NAMES.UPDATE_CUSTOMER, (customer) => {
      if (this.customer != customer) {
        this.customer_credit_dict = [];
        this.redeem_customer_credit = false;
        this.is_cashback = true;
      }
    });

    evntBus.on(EVENT_NAMES.SET_POS_SETTINGS, (data) => {
      this.pos_settings = data;
    });

    evntBus.on(EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT, (data) => {
      this.customer_info = data;
    });

    evntBus.on(EVENT_NAMES.UPDATE_DUE_DATE, (date) => {
      if (this.invoice_doc) {
        this.invoice_doc.due_date = date;
      }
    });
  },

  created() {
    document.addEventListener("keydown", this.shortPay.bind(this));
  },

  beforeUnmount() {
    // Clean up all timeouts
    Object.keys(this.set_full_amount_timeouts || {}).forEach((idx) => {
      if (this.set_full_amount_timeouts[idx]) {
        clearTimeout(this.set_full_amount_timeouts[idx]);
      }
    });
    this.set_full_amount_timeouts = {};

    // Clean up all event listeners
    const events = [
      EVENT_NAMES.TOGGLE_QUICK_RETURN,
      EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT,
      EVENT_NAMES.REGISTER_POS_PROFILE,
      EVENT_NAMES.ADD_THE_NEW_ADDRESS,
      EVENT_NAMES.UPDATE_CUSTOMER,
      EVENT_NAMES.SET_POS_SETTINGS,
      EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT,
      EVENT_NAMES.UPDATE_DUE_DATE,
      "update_delivery_date",
    ];

    events.forEach((event) => evntBus.$off(event));
  },

  destroyed() {
    document.removeEventListener("keydown", this.shortPay);
  },

  // ===== WATCHERS =====
  watch: {
    loyalty_amount(value) {
      if (value > this.available_pioints_amount) {
        this.invoice_doc.loyalty_amount = 0;
        this.invoice_doc.redeem_loyalty_points = 0;
        this.invoice_doc.loyalty_points = 0;
        this.showMessage(
          `Cannot enter points greater than available balance ${this.available_pioints_amount}`,
          "error"
        );
      } else {
        this.invoice_doc.loyalty_amount = this.flt(this.loyalty_amount);
        this.invoice_doc.redeem_loyalty_points = 1;
        this.invoice_doc.loyalty_points = this.flt(this.loyalty_amount);
      }
    },

    is_credit_sale(value) {
      if (value == 1 && Array.isArray(this.invoice_doc?.payments)) {
        this.invoice_doc.payments.forEach((payment) => {
          payment.amount = 0;
          payment.base_amount = 0;
        });
      }
    },

    is_write_off_change(value) {
      if (value == 1) {
        this.invoice_doc.write_off_amount = this.outstanding_amount;
        this.invoice_doc.write_off_outstanding_amount_automatically = 1;
      } else {
        this.invoice_doc.write_off_amount = 0;
        this.invoice_doc.write_off_outstanding_amount_automatically = 0;
      }
    },

    // Watch payments array to force recalculation of change_amount
    "invoice_doc.payments": {
      handler() {
        // Force update to recalculate computed properties
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      },
      deep: true,
    },

    redeemed_customer_credit(value) {
      if (value > this.available_customer_credit) {
        this.showMessage(
          `Customer credit can be redeemed up to ${this.available_customer_credit}`,
          "error"
        );
      }
    },
  },
};
