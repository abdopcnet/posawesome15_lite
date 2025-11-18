// Frontend logging: Use console.log/error/warn directly

export default {
  data() {
    return {
      float_precision: 3, // From your System Settings
      currency_precision: 2, // From your System Settings
    };
  },
  methods: {
    flt(value, precision, number_format, rounding_method) {
      try {
        if (!precision && precision != 0) {
          precision = this.currency_precision || 2;
        }
        // Use your fixed Banker's Rounding setting
        rounding_method = "Banker's Rounding";
        return flt(value, precision, number_format, rounding_method);
      } catch (error) {
        console.error("format.js", "flt error", error);
        return parseFloat(value || 0).toFixed(precision || 2);
      }
    },

    formatCurrency(value, precision) {
      try {
        // Simplified for single currency - no cache needed
        return format_number(
          value,
          null, // Use default number format
          precision || this.currency_precision || 2
        );
      } catch (error) {
        console.error("format.js", "currency error", error);
        return parseFloat(value || 0).toFixed(precision || 2);
      }
    },

    formatFloat(value, precision) {
      try {
        // Simplified for single currency - use your float_precision=3
        return format_number(
          value,
          null,
          precision || this.float_precision || 3
        );
      } catch (error) {
        console.error("format.js", "float error", error);
        return parseFloat(value || 0).toFixed(precision || 3);
      }
    },

    setFormatedCurrency(
      el,
      field_name,
      precision,
      no_negative = false,
      $event
    ) {
      let value = 0;
      try {
        let _value = parseFloat($event.target.value);
        if (!isNaN(_value)) {
          value = _value;
        }
        if (no_negative && value < 0) {
          value = value * -1;
        }
        value = this.formatCurrency($event.target.value, precision);
      } catch (e) {
        console.error("format.js", "setCurrency error", e);
        value = parseFloat($event.target.value || 0).toFixed(precision || 2);
      }

      if (typeof el === "object") {
        el[field_name] = value;
      } else {
        this[field_name] = value;
      }
      return value;
    },

    setFormatedFloat(el, field_name, precision, no_negative = false, $event) {
      let value = 0;
      try {
        value = parseFloat($event.target.value);
        if (isNaN(value)) {
          value = 0;
        } else if (no_negative && value < 0) {
          value = value * -1;
        }
        value = this.formatFloat($event.target.value, precision);
      } catch (e) {
        console.error("format.js", "setFloat error", e);
        value = parseFloat($event.target.value || 0).toFixed(precision || 3);
      }

      if (typeof el === "object") {
        el[field_name] = value;
      } else {
        this[field_name] = value;
      }
      return value;
    },

    currencySymbol(currency) {
      return "";
    },

    isNumber(value) {
      try {
        const pattern = /^-?(\d+|\d{1,3}(\.\d{3})*)(,\d+)?$/;
        return pattern.test(value) || "invalid number";
      } catch (error) {
        console.error("format.js", "isNumber error", error);
        return false;
      }
    },
  },

  mounted() {
    // Use your fixed System Settings values
    this.float_precision = frappe.defaults.get_default("float_precision") || 3;
    this.currency_precision =
      frappe.defaults.get_default("currency_precision") || 2;
  },
};
