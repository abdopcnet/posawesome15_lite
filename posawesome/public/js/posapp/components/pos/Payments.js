// ===== SECTION 1: IMPORTS =====
import { evntBus } from '../../bus';
import format from '../../format';
import { API_MAP } from '../../api_mapper.js';

const EVENT_NAMES = {
  SHOW_PAYMENT: 'show_payment',
  SET_CUSTOMER_READONLY: 'set_customer_readonly',
  SHOW_MESSAGE: 'show_mesage',
  SET_LAST_INVOICE: 'set_last_invoice',
  NEW_INVOICE: 'new_invoice',
  INVOICE_SUBMITTED: 'invoice_submitted',
  PAYMENTS_UPDATED: 'payments_updated',
  FREEZE: 'freeze',
  UNFREEZE: 'unfreeze',
  OPEN_EDIT_CUSTOMER: 'open_edit_customer',
  OPEN_NEW_ADDRESS: 'open_new_address',
  TOGGLE_QUICK_RETURN: 'toggle_quick_return',
  SEND_INVOICE_DOC_PAYMENT: 'send_invoice_doc_payment',
  REGISTER_POS_PROFILE: 'register_pos_profile',
  ADD_THE_NEW_ADDRESS: 'add_the_new_address',
  UPDATE_CUSTOMER: 'update_customer',
  SET_POS_SETTINGS: 'set_pos_settings',
  SET_CUSTOMER_INFO_TO_EDIT: 'set_customer_info_to_edit',
  UPDATE_DUE_DATE: 'update_due_date',
};

// ===== SECTION 2: EXPORT DEFAULT =====
export default {
  mixins: [format],

  // ===== DATA =====
  data() {
    return {
      loading: false,
      pos_profile: '',
      invoice_doc: '',
      customer: '',
      loyalty_amount: 0,
      is_credit_sale: 0,
      is_write_off_change: 0,
      addresses: [],
      paid_change: 0,
      paid_change_rules: [],
      is_return: false,
      is_cashback: true,
      redeem_customer_credit: false,
      customer_credit_dict: [],
      phone_dialog: false,
      pos_settings: '',
      customer_info: '',
      quick_return: false,
      selected_return_payment_idx: null,
    };
  },

  // ===== COMPUTED =====
  computed: {
    total_payments() {
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

    diff_payment() {
      const target_amount =
        flt(this.invoice_doc.rounded_total) || flt(this.invoice_doc.grand_total);
      const diff_payment = this.flt(target_amount - this.total_payments, this.currency_precision);
      this.paid_change = -diff_payment;
      return diff_payment >= 0 ? diff_payment : 0;
    },

    credit_change() {
      const change = -this.diff_payment;
      if (this.paid_change > change) return 0;
      return this.flt(this.paid_change - change, this.currency_precision);
    },

    available_pioints_amount() {
      if (!this.customer_info?.loyalty_points) return 0;
      return this.customer_info.loyalty_points;
    },

    available_customer_credit() {
      return this.customer_credit_dict.reduce((total, row) => total + row.total_credit, 0);
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
      return this.invoice_doc?.payments?.some((payment) => payment.type === 'Phone') || false;
    },
  },

  // ===== METHODS =====
  methods: {
    showMessage(text, color) {
      evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
    },

    emitPrintRequest() {
      this.$emit('request-print');
    },

    exposeSubmit(print = true, autoMode = false) {
      this.submit(undefined, autoMode, print);
    },

    autoPayWithDefault(invoice_doc) {
      this.invoice_doc = invoice_doc;
      const defaultPayment = this.getDefaultPayment();
      if (defaultPayment) {
        const total = this.flt(invoice_doc.rounded_total) || this.flt(invoice_doc.grand_total);
        defaultPayment.amount = this.flt(total, this.currency_precision);
      }
      this.exposeSubmit(true, true);
    },

    getDefaultPayment() {
      const payments = Array.isArray(this.invoice_doc?.payments) ? this.invoice_doc.payments : [];
      return payments.find((payment) => payment.default == 1) || payments[0] || null;
    },

    back_to_invoice() {
      evntBus.emit(EVENT_NAMES.SHOW_PAYMENT, 'false');
      evntBus.emit(EVENT_NAMES.SET_CUSTOMER_READONLY, false);
    },

    async submit(event, autoMode = false, print = false) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      try {
        await this.refreshInvoiceDoc();
      } catch (error) {
        console.warn(error?.message || 'Failed to refresh invoice before submit');
      }

      if (this.invoice_doc?.docstatus === 1) {
        if (print) {
          this.load_print_page();
        }
        this.showMessage('Invoice has already been submitted', 'info');
        evntBus.emit(EVENT_NAMES.SET_LAST_INVOICE, this.invoice_doc.name);
        evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
        this.back_to_invoice();
        return;
      }

      if (autoMode) {
        const defaultPayment = this.getDefaultPayment();
        if (!defaultPayment) {
          this.showMessage('No default payment method in POS profile', 'error');
          return;
        }
        const total =
          this.flt(this.invoice_doc.rounded_total) || this.flt(this.invoice_doc.grand_total);
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

        if (typeof this.selected_return_payment_idx === 'number') {
          this.invoice_doc.payments.forEach((payment) => {
            payment.amount = payment.idx === this.selected_return_payment_idx ? total : 0;
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
        flt(this.invoice_doc.rounded_total) || flt(this.invoice_doc.grand_total);
      const difference = Math.abs(totalPayedAmount - targetAmount);

      if (difference > 0.05) {
        this.showMessage(
          `Payment mismatch: Total ${totalPayedAmount} vs Target ${targetAmount}`,
          'error',
        );
        return;
      }

      if (this.invoice_doc.is_return && totalPayedAmount == 0) {
        this.invoice_doc.is_pos = 0;
      }

      if (this.customer_credit_dict.length) {
        this.customer_credit_dict.forEach((row) => {
          row.credit_to_redeem = flt(row.credit_to_redeem);
        });
      }

      const data = {
        total_change: !this.invoice_doc.is_return ? -this.diff_payment : 0,
        paid_change: !this.invoice_doc.is_return ? this.paid_change : 0,
        credit_change: -this.credit_change,
        redeemed_customer_credit: this.redeemed_customer_credit,
        customer_credit_dict: this.customer_credit_dict,
        is_cashback: this.is_cashback,
      };

      if (autoMode) {
        this.load_print_page();
        this.showMessage('Invoice printed using default payment method', 'success');
        evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
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
            this.showMessage(`Invoice ${r.message.name} submitted successfully`, 'success');
            this.addresses = [];
            evntBus.emit(EVENT_NAMES.NEW_INVOICE, 'false');
            evntBus.emit(EVENT_NAMES.INVOICE_SUBMITTED);
            this.back_to_invoice();
          } else {
            this.showMessage('Failed to submit invoice', 'error');
          }
        },
        error: (err) => {
          const errorMsg = err?.message || '';
          const isTimestampError =
            typeof errorMsg === 'string' && errorMsg.includes('Document has been modified');

          if (!retrying && isTimestampError) {
            this.refreshInvoiceDoc()
              .then(() => {
                this.submit_invoice(print, autoMode, true);
              })
              .catch(() => {
                this.showMessage('Invoice was modified elsewhere, please try again', 'warning');
              });
            return;
          }

          this.showMessage(err?.message || 'Failed to submit invoice', 'error');
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
            doctype: 'Sales Invoice',
            name: this.invoice_doc.name,
          },
          async: true,
          callback: (res) => {
            if (res.message) {
              const freshDoc = res.message;

              if (shouldMergeLocalPayments && freshDoc.docstatus === 0) {
                const mergedPayments = (freshDoc.payments || []).map((payment) => {
                  const localMatch = localPayments.find((localPayment) => {
                    if (localPayment.idx !== undefined && payment.idx !== undefined) {
                      return payment.idx === localPayment.idx;
                    }
                    return payment.mode_of_payment === localPayment.mode_of_payment;
                  });

                  return localMatch ? { ...payment, amount: localMatch.amount } : payment;
                });

                const seen = new Set(
                  mergedPayments.map(
                    (payment) => `${payment.mode_of_payment || ''}__${payment.idx || ''}`,
                  ),
                );

                localPayments.forEach((localPayment) => {
                  const key = `${localPayment.mode_of_payment || ''}__${localPayment.idx || ''}`;
                  if (!seen.has(key) && flt(localPayment.amount)) {
                    mergedPayments.push(localPayment);
                  }
                });

                freshDoc.payments = mergedPayments;
              }

              this.invoice_doc = freshDoc;
              resolve();
            } else {
              reject(new Error('Failed to refresh invoice'));
            }
          },
          error: (err) => reject(err),
        });
      });
    },

    set_full_amount(idx) {
      const isReturn = !!this.invoice_doc.is_return;
      const total = this.invoice_doc.rounded_total || this.invoice_doc.grand_total;

      this.invoice_doc.payments.forEach((p) => {
        p.amount = 0;
        if (p.base_amount !== undefined) p.base_amount = 0;
      });

      const payment = this.invoice_doc.payments.find((p) => p.idx == idx);
      if (payment) {
        payment.amount = isReturn ? -Math.abs(total) : total;
        if (payment.base_amount !== undefined) payment.base_amount = payment.amount;
      }

      evntBus.emit(
        EVENT_NAMES.PAYMENTS_UPDATED,
        JSON.parse(JSON.stringify(this.invoice_doc.payments)),
      );
    },

    set_rest_amount(idx) {
      const isReturn = !!this.invoice_doc.is_return;
      const invoice_total =
        flt(this.invoice_doc.rounded_total) || flt(this.invoice_doc.grand_total);
      const total_payments = this.total_payments;
      const actual_remaining = this.flt(invoice_total - total_payments, this.currency_precision);

      const payment = this.invoice_doc.payments.find((p) => p.idx === idx);
      if (!payment || this.flt(payment.amount) !== 0) {
        return;
      }

      if (actual_remaining > 0) {
        let amount = actual_remaining;
        if (isReturn) amount = -Math.abs(amount);

        payment.amount = amount;
        if (payment.base_amount !== undefined) {
          payment.base_amount = isReturn ? -Math.abs(amount) : amount;
        }
        evntBus.emit(
          EVENT_NAMES.PAYMENTS_UPDATED,
          JSON.parse(JSON.stringify(this.invoice_doc.payments)),
        );
      } else if (actual_remaining < 0) {
        let excess_amount = Math.abs(actual_remaining);
        if (isReturn) excess_amount = -Math.abs(excess_amount);

        payment.amount = excess_amount;
        if (payment.base_amount !== undefined) {
          payment.base_amount = isReturn ? -Math.abs(excess_amount) : excess_amount;
        }
        evntBus.emit(
          EVENT_NAMES.PAYMENTS_UPDATED,
          JSON.parse(JSON.stringify(this.invoice_doc.payments)),
        );
      }
    },

    clear_all_amounts() {
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = 0;
      });
    },

    load_print_page() {
      const print_format =
        this.pos_profile.print_format_for_online || this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url = `${frappe.urllib.get_base_url()}/printview?doctype=Sales%20Invoice&name=${this.invoice_doc.name}&trigger_print=1&format=${print_format}&no_letterhead=${letter_head}`;

      const printWindow = window.open(url, 'Print');
      printWindow.addEventListener(
        'load',
        function () {
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        },
        true,
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
      if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.submit();
      }
    },

    set_paid_change() {
      if (!this.paid_change) this.paid_change = 0;

      this.paid_change_rules = [];
      const change = -this.diff_payment;

      if (this.paid_change > change) {
        this.paid_change_rules = ['Paid change cannot be greater than total change!'];
        this.credit_change = 0;
      }
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
                remainAmount >= row.total_credit ? row.total_credit : remainAmount;
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
        this.showMessage('Please enter customer phone number', 'error');
        evntBus.emit(EVENT_NAMES.OPEN_EDIT_CUSTOMER);
        this.back_to_invoice();
        return;
      }

      evntBus.emit(EVENT_NAMES.FREEZE, { title: 'Please wait for payment...' });

      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = flt(payment.amount);
      });

      evntBus.emit(EVENT_NAMES.UNFREEZE);
      this.showMessage('Payment request feature has been disabled', 'info');
    },
  },

  // ===== LIFECYCLE HOOKS =====
  mounted() {
    this.$nextTick(() => {
      evntBus.on(EVENT_NAMES.TOGGLE_QUICK_RETURN, (value) => {
        this.quick_return = value;
      });

      evntBus.on(EVENT_NAMES.SEND_INVOICE_DOC_PAYMENT, (invoice_doc) => {
        this.invoice_doc = invoice_doc;

        if (!Array.isArray(this.invoice_doc.payments)) {
          this.showMessage('No payments array in invoice document', 'error');
          this.invoice_doc.payments = [];
        } else {
          this.invoice_doc.payments.forEach((payment, index) => {
            if (!payment.idx) payment.idx = index + 1;
          });
        }

        const default_payment = this.invoice_doc.payments.find((payment) => payment.default == 1);
        this.is_credit_sale = 0;
        this.is_write_off_change = 0;

        if (default_payment && !invoice_doc.is_return) {
          const total = this.flt(invoice_doc.rounded_total) || this.flt(invoice_doc.grand_total);
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
            if (default_payment.base_amount !== undefined) default_payment.base_amount = neg;
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
    document.addEventListener('keydown', this.shortPay.bind(this));
  },

  beforeUnmount() {
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
      'update_delivery_date',
    ];

    events.forEach((event) => evntBus.$off(event));
  },

  destroyed() {
    document.removeEventListener('keydown', this.shortPay);
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
          'error',
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
        this.invoice_doc.write_off_amount = this.diff_payment;
        this.invoice_doc.write_off_outstanding_amount_automatically = 1;
      } else {
        this.invoice_doc.write_off_amount = 0;
        this.invoice_doc.write_off_outstanding_amount_automatically = 0;
      }
    },

    redeemed_customer_credit(value) {
      if (value > this.available_customer_credit) {
        this.showMessage(
          `Customer credit can be redeemed up to ${this.available_customer_credit}`,
          'error',
        );
      }
    },
  },
};
