import { evntBus } from '../../bus';
import { API_MAP } from '../../api_mapper.js';
export default {
  data: () => ({
    addressDialog: false,
    address: {},
    customer: '',
  }),

  methods: {
    close_dialog() {
      this.addressDialog = false;
    },

    submit_dialog() {
      const vm = this;
      this.address.customer = this.customer;
      this.address.doctype = 'Customer';
      frappe.call({
        method: API_MAP.CUSTOMER.CREATE_CUSTOMER_ADDRESS,
        args: {
          args: this.address,
        },
        callback: (r) => {
          if (!r.exc) {
            evntBus.emit('add_the_new_address', r.message);
            evntBus.emit('show_mesage', {
              text: 'Customer address created successfully.',
              color: 'success',
            });
            vm.addressDialog = false;
            vm.customer = '';
            vm.address = {};
          }
        },
      });
    },
  },
  created: function () {
    evntBus.on('open_new_address', (data) => {
      this.addressDialog = true;
      this.customer = data;
    });
  },

  beforeDestroy() {
    // Clean up event listener (use .off if available)
    if (evntBus && typeof evntBus.off === 'function') {
      evntBus.off('open_new_address');
    }
  },
};
