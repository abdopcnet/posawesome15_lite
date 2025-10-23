<template>
  <div class="invoice-totals">
    <div class="totals-section">
      <!-- Subtotal -->
      <div class="total-row">
        <span class="total-label">Subtotal:</span>
        <span class="total-value">{{ formatCurrency(subtotal) }}</span>
      </div>

      <!-- Tax Total -->
      <div v-if="tax_total > 0" class="total-row">
        <span class="total-label">Tax:</span>
        <span class="total-value">{{ formatCurrency(tax_total) }}</span>
      </div>

      <!-- Discount Total -->
      <div v-if="discount_total > 0" class="total-row discount-row">
        <span class="total-label">Discount:</span>
        <span class="total-value discount-value">-{{ formatCurrency(discount_total) }}</span>
      </div>

      <!-- Grand Total -->
      <div class="total-row grand-total">
        <span class="total-label">Total:</span>
        <span class="total-value grand-total-value">{{ formatCurrency(grand_total) }}</span>
      </div>
    </div>

    <!-- Payment Actions -->
    <div class="payment-actions">
      <button 
        class="payment-btn"
        @click="$emit('proceed-to-payment')"
        :disabled="!canProceedToPayment"
        :class="{ 'disabled': !canProceedToPayment }"
      >
        <i class="mdi mdi-credit-card payment-icon"></i>
        <span class="payment-text">Proceed to Payment</span>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InvoiceTotals',
  props: {
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
    },
    items: {
      type: Array,
      default: () => []
    }
  },
  emits: ['proceed-to-payment'],
  computed: {
    canProceedToPayment() {
      return this.items.length > 0 && this.grand_total > 0
    }
  },
  methods: {
    formatCurrency(value) {
      if (!value) return '0.00'
      return parseFloat(value).toFixed(2)
    }
  }
}
</script>

<style scoped>
.invoice-totals {
  background: white;
  border-top: 2px solid #e0e0e0;
  padding: 16px;
}

.totals-section {
  margin-bottom: 16px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.total-row:last-child {
  border-bottom: none;
}

.total-label {
  font-size: 14px;
  font-weight: 500;
  color: #424242;
}

.total-value {
  font-size: 14px;
  font-weight: 600;
  color: #424242;
}

.discount-row .total-label {
  color: #f44336;
}

.discount-value {
  color: #f44336;
}

.grand-total {
  border-top: 2px solid #e0e0e0;
  border-bottom: none;
  margin-top: 8px;
  padding-top: 12px;
}

.grand-total .total-label {
  font-size: 16px;
  font-weight: 700;
  color: #1976d2;
}

.grand-total-value {
  font-size: 16px;
  font-weight: 700;
  color: #1976d2;
}

.payment-actions {
  display: flex;
  justify-content: center;
}

.payment-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 180px;
  justify-content: center;
}

.payment-btn:hover:not(.disabled) {
  background: #45a049;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.payment-btn.disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.payment-icon {
  font-size: 16px;
}

.payment-text {
  font-weight: 600;
}
</style>
