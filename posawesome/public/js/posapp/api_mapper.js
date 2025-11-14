/**
 * POS Awesome API Mapper
 *
 * Central map of all API endpoints actually used in frontend files
 * No invention or addition - just collecting what already exists
 */

const API_MAP = {
  // Sales Invoice APIs (from Invoice.vue)
  SALES_INVOICE: {
    CREATE: "posawesome.posawesome.api.sales_invoice.create_invoice",
    UPDATE: "posawesome.posawesome.api.sales_invoice.update_invoice",
    SUBMIT: "posawesome.posawesome.api.sales_invoice.submit_invoice",
    DELETE: "posawesome.posawesome.api.sales_invoice.delete_invoice",
    GET_INVOICES_FOR_RETURN:
      "posawesome.posawesome.api.sales_invoice.get_invoices_for_return",
  },

  // Customer APIs (from Customer.vue, UpdateCustomer.vue, Payments.vue, NewAddress.vue)
  CUSTOMER: {
    GET_CUSTOMER: "posawesome.posawesome.api.customer.get_customer",
    GET_MANY_CUSTOMERS: "posawesome.posawesome.api.customer.get_many_customers",
    GET_CUSTOMERS_COUNT:
      "posawesome.posawesome.api.customer.get_customers_count",
    POST_CUSTOMER: "posawesome.posawesome.api.customer.create_customer",
    UPDATE_CUSTOMER: "posawesome.posawesome.api.customer.update_customer",
    CREATE_CUSTOMER_ADDRESS:
      "posawesome.posawesome.api.customer.create_customer_address",
    GET_CUSTOMER_CREDIT:
      "posawesome.posawesome.api.customer.get_customer_credit",
    GET_ADDRESSES:
      "posawesome.posawesome.api.customer.get_many_customer_addresses",
  },

  // POS Profile APIs (from Invoice.vue)
  POS_PROFILE: {
    GET_DEFAULT_PAYMENT:
      "posawesome.posawesome.api.pos_profile.get_default_payment_from_pos_profile",
  },

  // Item APIs (from ItemsSelector.vue, Invoice.vue)
  ITEM: {
    GET_ITEMS: "posawesome.posawesome.api.item.get_items",
    GET_ITEMS_GROUPS: "posawesome.posawesome.api.item.get_items_groups",
    GET_BARCODE_ITEM: "posawesome.posawesome.api.item.get_barcode_item", // Central unified barcode handler
    PROCESS_BATCH_SELECTION:
      "posawesome.posawesome.api.item.process_batch_selection",
  },

  // POS Offer APIs (from Invoice.vue, Pos.vue)
  POS_OFFER: {
    GET_APPLICABLE_OFFERS:
      "posawesome.posawesome.doctype.pos_offer.pos_offer.get_applicable_offers",
    GET_OFFERS_FOR_PROFILE:
      "posawesome.posawesome.doctype.pos_offer.pos_offer.get_offers_for_profile",
    APPLY_OFFERS_TO_INVOICE:
      "posawesome.posawesome.doctype.pos_offer.pos_offer.get_offers",
  },

  // POS Opening Shift APIs (from OpeningDialog.vue, Pos.vue, Navbar.vue)
  POS_OPENING_SHIFT: {
    GET_OPENING_DATA:
      "posawesome.posawesome.api.pos_profile.get_opening_dialog_data",
    CREATE_OPENING_VOUCHER:
      "posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.create_opening_voucher",
    GET_CURRENT_SHIFT_NAME:
      "posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_current_shift_name",
    GET_ALL_OPEN_SHIFTS:
      "posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_all_open_shifts",
    GET_USER_SHIFT_INVOICE_COUNT:
      "posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_user_shift_invoice_count",
    GET_PROFILE_USERS:
      "posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.get_profile_users",
    CHECK_OPENING_TIME_ALLOWED:
      "posawesome.posawesome.doctype.pos_opening_shift.pos_opening_shift.check_opening_time_allowed",
  },

  // POS Closing Shift APIs (from ClosingDialog.vue)
  POS_CLOSING_SHIFT: {
    CHECK_CLOSING_TIME_ALLOWED:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.check_closing_time_allowed",
    GET_CASHIERS:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_cashiers",
    GET_POS_INVOICES:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_pos_invoices",
    GET_PAYMENTS_ENTRIES:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_payments_entries",
    MAKE_CLOSING_SHIFT:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.make_closing_shift_from_opening",
    SUBMIT_CLOSING_SHIFT:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.submit_closing_shift",
    GET_CURRENT_CASH_TOTAL:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_current_cash_total",
    GET_CURRENT_NON_CASH_TOTAL:
      "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_current_non_cash_total",
  },

  // ERPNext Standard APIs (from Invoice.vue, Returns.vue, Payments.vue, Pos.vue)
  FRAPPE: {
    CLIENT_GET: "frappe.client.get",
    CLIENT_DELETE: "frappe.client.delete",
    PING: "frappe.ping",
  },
};

// Export the map
export { API_MAP };
