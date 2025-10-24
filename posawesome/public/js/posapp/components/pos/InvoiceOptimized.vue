<template>
  <div class="invoice-container">
    <div class="cards py-0 grey lighten-5 d-flex flex-column flex-grow-1" style="min-height: 0">
      <!-- Invoice Header -->
      <InvoiceHeader 
        :invoice_doc="invoice_doc"
        @show-returns="show_returns"
        @clear-invoice="clear_invoice"
      />

      <!-- Invoice Items Table -->
      <InvoiceItems
        :items="items"
        :dynamicHeaders="dynamicHeaders"
        :invoice_doc="invoice_doc"
        @decrease-quantity="decreaseQuantity"
        @increase-quantity="increaseQuantity"
        @qty-input="onQtyInput"
        @qty-change="onQtyChange"
        @set-item-rate="setItemRate"
        @remove-item="removeItem"
      />

      <!-- Invoice Totals -->
      <InvoiceTotals
        :subtotal="subtotal"
        :tax_total="tax_total"
        :discount_total="discount_total"
        :grand_total="grand_total"
        :items="items"
        @proceed-to-payment="proceed_to_payment"
      />
    </div>
  </div>
</template>

<script>
import InvoiceHeader from './InvoiceHeader.vue'
import InvoiceItems from './InvoiceItems.vue'
import InvoiceTotals from './InvoiceTotals.vue'

export default {
  name: 'Invoice',
  components: {
    InvoiceHeader,
    InvoiceItems,
    InvoiceTotals
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
      type: Boolean,
      default: false,
    },
    items: {
      type: Array,
      default: () => []
    },
    invoice_doc: {
      type: Object,
      default: null
    },
    dynamicHeaders: {
      type: Array,
      default: () => []
    },
    subtotal: {
      type: Number,
      default: 0
    },
    tax_total: {
      type: Number,
      default: 0
    },
    discount_total: {
      type: Number,
      default: 0
    },
    grand_total: {
      type: Number,
      default: 0
    }
  },
  emits: [
    'show-returns',
    'clear-invoice',
    'decrease-quantity',
    'increase-quantity',
    'qty-input',
    'qty-change',
    'set-item-rate',
    'remove-item',
    'proceed-to-payment'
  ],
  methods: {
    show_returns() {
      this.$emit('show-returns')
    },
    
    clear_invoice() {
      this.$emit('clear-invoice')
    },
    
    decreaseQuantity(item) {
      this.$emit('decrease-quantity', item)
    },
    
    increaseQuantity(item) {
      this.$emit('increase-quantity', item)
    },
    
    onQtyInput(item) {
      this.$emit('qty-input', item)
    },
    
    onQtyChange(item) {
      this.$emit('qty-change', item)
    },
    
    setItemRate(item, event) {
      this.$emit('set-item-rate', item, event)
    },
    
    removeItem(item) {
      this.$emit('remove-item', item)
    },
    
    proceed_to_payment() {
      this.$emit('proceed-to-payment')
    }
  }
}
</script>

<style scoped>
.invoice-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.cards {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
