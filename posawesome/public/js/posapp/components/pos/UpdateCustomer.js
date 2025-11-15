import { evntBus } from "../../bus";
import { API_MAP } from "../../api_mapper.js";

const EVENT_NAMES = {
  SHOW_MESSAGE: "show_mesage",
  ADD_CUSTOMER_TO_LIST: "add_customer_to_list",
  UPDATE_CUSTOMER_IN_LIST: "update_customer_in_list",
  SET_CUSTOMER: "set_customer",
  FETCH_CUSTOMER_DETAILS: "fetch_customer_details",
  SET_CUSTOMER_INFO_TO_EDIT: "set_customer_info_to_edit",

  OPEN_UPDATE_CUSTOMER: "open_update_customer",
  REGISTER_POS_PROFILE: "register_pos_profile",
  PAYMENTS_REGISTER_POS_PROFILE: "payments_register_pos_profile",
};

const VALIDATION_MESSAGES = {
  CUSTOMER_NAME_REQUIRED: "Customer name is required.",
  CUSTOMER_GROUP_REQUIRED: "Customer group name is required.",
  TERRITORY_REQUIRED: "Territory name is required.",
};

const SUCCESS_MESSAGES = {
  CUSTOMER_CREATED: "Customer created successfully.",
  CUSTOMER_UPDATED: "Customer data updated successfully.",
};

const ERROR_MESSAGES = {
  FAILED_TO_CREATE: "Failed to create customer.",
  FAILED_TO_LOAD_GROUPS: "Error loading customer groups",
  FAILED_TO_LOAD_TERRITORIES: "Error loading territories",
  FAILED_TO_LOAD_GENDERS: "Error loading genders",
};

const CUSTOMER_TYPE = {
  INDIVIDUAL: "Individual",
};

const DB_LIMITS = {
  CUSTOMER_GROUPS: 1000,
  TERRITORIES: 5000,
  GENDERS: 10,
};

const DEFAULT_VALUES = {
  CUSTOMER_GROUP: "Individual",
  TERRITORY: "Rest Of The World",
};

export default {
  name: "UpdateCustomer",
  data() {
    return {
      customerDialog: false,
      pos_profile: null,
      customer_id: "",
      customer_name: "",
      tax_id: "",
      mobile_no: "",
      email_id: "",
      posa_referral_code: "",
      posa_discount: 0,
      customer_type: CUSTOMER_TYPE.INDIVIDUAL,
      gender: "",
      loyalty_points: null,
      loyalty_program: null,
      group: "",
      groups: [],
      territory: "",
      territorys: [],
      genders: [],
    };
  },

  methods: {
    close_dialog() {
      this.customerDialog = false;
      this.clear_customer();
    },
    clear_customer() {
      this.customer_name = "";
      this.tax_id = "";
      this.mobile_no = "";
      this.email_id = "";
      this.posa_referral_code = "";
      this.posa_discount = 0;
      this.group = frappe.defaults.get_user_default("Customer Group");
      this.territory = frappe.defaults.get_user_default("Territory");
      this.customer_id = "";
      this.customer_type = CUSTOMER_TYPE.INDIVIDUAL;
      this.gender = "";
      this.loyalty_points = null;
      this.loyalty_program = null;
    },

    getCustomerGroups() {
      if (this.groups.length > 0) return;

      frappe.db
        .get_list("Customer Group", {
          fields: ["name"],
          filters: { is_group: 0 },
          limit: DB_LIMITS.CUSTOMER_GROUPS,
          order_by: "name",
        })
        .then((data) => {
          if (data.length > 0) {
            this.groups = data.map((el) => el.name);
          }
        })
        .catch((err) => {
          console.log("[UpdateCustomer.js] getCustomerGroups error:", err);
          this.showMessage(ERROR_MESSAGES.FAILED_TO_LOAD_GROUPS, "error");
        });
    },

    getCustomerTerritorys() {
      if (this.territorys.length > 0) return;

      frappe.db
        .get_list("Territory", {
          fields: ["name"],
          filters: { is_group: 0 },
          limit: DB_LIMITS.TERRITORIES,
          order_by: "name",
        })
        .then((data) => {
          if (data.length > 0) {
            this.territorys = data.map((el) => el.name);
          }
        })
        .catch((err) => {
          console.log("[UpdateCustomer.js] getCustomerTerritorys error:", err);
          this.showMessage(ERROR_MESSAGES.FAILED_TO_LOAD_TERRITORIES, "error");
        });
    },

    getGenders() {
      frappe.db
        .get_list("Gender", {
          fields: ["name"],
          page_length: DB_LIMITS.GENDERS,
        })
        .then((data) => {
          if (data.length > 0) {
            this.genders = data.map((el) => el.name);
          }
        })
        .catch((err) => {
          console.log("[UpdateCustomer.js] getGenders error:", err);
          this.showMessage(ERROR_MESSAGES.FAILED_TO_LOAD_GENDERS, "error");
        });
    },

    validateForm() {
      if (!this.customer_name) {
        this.showMessage(VALIDATION_MESSAGES.CUSTOMER_NAME_REQUIRED, "error");
        return false;
      }
      if (!this.group) {
        this.showMessage(VALIDATION_MESSAGES.CUSTOMER_GROUP_REQUIRED, "error");
        return false;
      }
      if (!this.territory) {
        this.showMessage(VALIDATION_MESSAGES.TERRITORY_REQUIRED, "error");
        return false;
      }
      return true;
    },

    submit_dialog() {
      if (!this.validateForm()) {
        return;
      }

      const args = {
        customer_id: this.customer_id,
        customer_name: this.customer_name,
        company: this.pos_profile.company,
        tax_id: this.tax_id,
        mobile_no: this.mobile_no,
        email_id: this.email_id,
        posa_referral_code: this.posa_referral_code,
        posa_discount: this.posa_discount,
        customer_group: this.group,
        territory: this.territory,
        customer_type: this.customer_type,
        gender: this.gender,
        method: this.customer_id ? "update" : "create",
        pos_profile_doc: JSON.stringify(this.pos_profile),
      };

      frappe.call({
        method: this.customer_id
          ? API_MAP.CUSTOMER.UPDATE_CUSTOMER
          : API_MAP.CUSTOMER.POST_CUSTOMER,
        args: args,
        callback: (r) => {
          if (!r.exc && r.message.name) {
            this.handleCustomerSuccess(r.message.name, args);
          } else {
            this.handleCustomerError();
          }
        },
        error: (err) => {
          console.log("[UpdateCustomer.js] submit_dialog error:", err);
          this.handleCustomerError();
        },
      });

      this.customerDialog = false;
    },

    handleCustomerSuccess(customerName, args) {
      const isUpdate = !!this.customer_id;
      const message = isUpdate
        ? SUCCESS_MESSAGES.CUSTOMER_UPDATED
        : SUCCESS_MESSAGES.CUSTOMER_CREATED;

      args.name = customerName;

      if (!isUpdate) {
        evntBus.emit(EVENT_NAMES.ADD_CUSTOMER_TO_LIST, args);
        evntBus.emit(EVENT_NAMES.SET_CUSTOMER, customerName);
        evntBus.emit(EVENT_NAMES.FETCH_CUSTOMER_DETAILS);
      } else {
        // Fetch updated customer data from server and update customer_info
        frappe.call({
          method: API_MAP.CUSTOMER.GET_CUSTOMER,
          args: { customer_id: customerName },
          callback: (r) => {
            if (!r.exc && r.message) {
              // Update customer_info with fresh data from server
              evntBus.emit(EVENT_NAMES.SET_CUSTOMER_INFO_TO_EDIT, r.message);
              // Also update the customer in the customers list
              evntBus.emit(EVENT_NAMES.UPDATE_CUSTOMER_IN_LIST, r.message);
            }
          },
          error: (err) => {
            console.log(
              "[UpdateCustomer.js] handleCustomerSuccess error:",
              err
            );
          },
        });
      }

      this.close_dialog();
    },

    handleCustomerError() {
      this.showMessage(ERROR_MESSAGES.FAILED_TO_CREATE, "error");
    },

    showMessage(text, color) {
      evntBus.emit(EVENT_NAMES.SHOW_MESSAGE, { text, color });
    },

    populateCustomerData(data) {
      if (!data) return;

      this.customer_name = data.customer_name;
      this.customer_id = data.name;
      this.tax_id = data.tax_id || "";
      this.mobile_no = data.mobile_no || "";
      this.email_id = data.email_id || "";
      this.posa_referral_code = data.posa_referral_code || "";
      this.posa_discount = data.posa_discount || 0;
      this.group = data.customer_group;
      this.territory = data.territory;
      this.customer_type = data.customer_type || "Individual";
      this.loyalty_points = data.loyalty_points;
      this.loyalty_program = data.loyalty_program;
      this.gender = data.gender || "";
    },

    registerEventListeners() {
      evntBus.on(
        EVENT_NAMES.OPEN_UPDATE_CUSTOMER,
        this.handleOpenUpdateCustomer
      );
      evntBus.on(
        EVENT_NAMES.REGISTER_POS_PROFILE,
        this.handleRegisterPosProfile
      );
      evntBus.on(
        EVENT_NAMES.PAYMENTS_REGISTER_POS_PROFILE,
        this.handlePaymentsRegisterPosProfile
      );
    },

    handleOpenUpdateCustomer(data) {
      this.customerDialog = true;
      this.populateCustomerData(data);

      this.getCustomerGroups();
      this.getCustomerTerritorys();
      this.getGenders();
    },

    handleRegisterPosProfile(data) {
      this.pos_profile = data.pos_profile;
    },

    handlePaymentsRegisterPosProfile(data) {
      this.pos_profile = data.pos_profile;
    },
  },

  created() {
    this.registerEventListeners();

    this.group =
      frappe.defaults.get_user_default("Customer Group") ||
      DEFAULT_VALUES.CUSTOMER_GROUP;
    this.territory =
      frappe.defaults.get_user_default("Territory") || DEFAULT_VALUES.TERRITORY;
  },

  beforeDestroy() {
    // Clean up all event listeners
    evntBus.$off(
      EVENT_NAMES.OPEN_UPDATE_CUSTOMER,
      this.handleOpenUpdateCustomer
    );
    evntBus.$off(
      EVENT_NAMES.REGISTER_POS_PROFILE,
      this.handleRegisterPosProfile
    );
    evntBus.$off(
      EVENT_NAMES.PAYMENTS_REGISTER_POS_PROFILE,
      this.handlePaymentsRegisterPosProfile
    );
  },
};
