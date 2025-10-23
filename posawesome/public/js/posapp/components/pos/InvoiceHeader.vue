<template>
  <div class="invoice-header">
    <!-- Compact Customer Section -->
    <div class="compact-customer-section">
      <Customer></Customer>
    </div>
    
    <!-- Invoice Actions -->
    <div class="invoice-actions">
      <button 
        v-if="!invoice_doc?.is_return" 
        class="action-btn return-btn" 
        @click="show_returns"
        title="Returns"
      >
        <i class="mdi mdi-undo-variant action-icon"></i>
        <span class="action-text">Returns</span>
      </button>
      
      <button 
        class="action-btn clear-btn" 
        @click="clear_invoice"
        title="Clear Invoice"
      >
        <i class="mdi mdi-delete-sweep action-icon"></i>
        <span class="action-text">Clear</span>
      </button>
    </div>
  </div>
</template>

<script>
import Customer from './Customer.vue'

export default {
  name: 'InvoiceHeader',
  components: {
    Customer
  },
  props: {
    invoice_doc: {
      type: Object,
      default: null
    }
  },
  emits: ['show-returns', 'clear-invoice'],
  methods: {
    show_returns() {
      this.$emit('show-returns')
    },
    clear_invoice() {
      this.$emit('clear-invoice')
    }
  }
}
</script>

<style scoped>
.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.compact-customer-section {
  flex: 1;
}

.invoice-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.return-btn {
  background: #ff9800;
  color: white;
}

.return-btn:hover {
  background: #f57c00;
}

.clear-btn {
  background: #f44336;
  color: white;
}

.clear-btn:hover {
  background: #d32f2f;
}

.action-icon {
  font-size: 14px;
}

.action-text {
  font-weight: 500;
}
</style>
