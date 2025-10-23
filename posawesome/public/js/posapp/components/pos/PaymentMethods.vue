<template>
  <div class="payment-methods">
    <div class="section-header">
      <h3>Payment Methods</h3>
    </div>
    
    <div class="payment-methods-list">
      <div
        class="payment-method-row"
        v-for="payment in invoice_doc.payments"
        :key="payment.name"
      >
        <div class="payment-amount">
          <label>Amount</label>
          <div class="field-input-wrapper">
            <span class="currency-prefix">{{ currencySymbol(invoice_doc.currency) }}</span>
            <input
              type="text"
              class="compact-input"
              :value="formatCurrency(payment.amount)"
              @change="$emit('set-formatted-currency', payment, 'amount', null, true, $event)"
              @focus="$emit('set-rest-amount', payment.idx)"
              :readonly="invoice_doc.is_return ? true : false"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <button
          class="payment-method-btn"
          :class="{ 'has-request': payment.type == 'Phone' && payment.amount > 0 && request_payment_field }"
          @click="$emit('set-full-amount', payment.idx)"
        >
          {{ payment.mode_of_payment }}
        </button>
        
        <button
          v-if="payment.type == 'Phone' && payment.amount > 0 && request_payment_field"
          class="request-btn"
          :disabled="payment.amount == 0"
          @click="$emit('request-payment', payment)"
        >
          Request
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentMethods',
  props: {
    invoice_doc: {
      type: Object,
      default: null
    },
    request_payment_field: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'set-formatted-currency',
    'set-rest-amount',
    'set-full-amount',
    'request-payment'
  ],
  methods: {
    formatCurrency(value) {
      if (!value) return '0.00'
      return parseFloat(value).toFixed(2)
    },
    
    currencySymbol(currency) {
      const symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'INR': '₹',
        'AED': 'د.إ',
        'SAR': 'ر.س',
        'EGP': '£'
      }
      return symbols[currency] || currency
    }
  }
}
</script>

<style scoped>
.payment-methods {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #424242;
  margin: 0;
}

.payment-methods-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-method-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
}

.payment-amount {
  flex: 1;
}

.payment-amount label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 4px;
}

.field-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-prefix {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: #666;
  z-index: 1;
}

.compact-input {
  width: 100%;
  height: 36px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0 12px 0 32px;
  font-size: 14px;
  background: white;
}

.compact-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.payment-method-btn {
  padding: 8px 16px;
  border: 1px solid #1976d2;
  background: #1976d2;
  color: white;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.payment-method-btn:hover {
  background: #1565c0;
  border-color: #1565c0;
}

.payment-method-btn.has-request {
  background: #4caf50;
  border-color: #4caf50;
}

.payment-method-btn.has-request:hover {
  background: #45a049;
  border-color: #45a049;
}

.request-btn {
  padding: 8px 12px;
  border: 1px solid #ff9800;
  background: #ff9800;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.request-btn:hover:not(:disabled) {
  background: #f57c00;
  border-color: #f57c00;
}

.request-btn:disabled {
  background: #ccc;
  border-color: #ccc;
  cursor: not-allowed;
}
</style>
