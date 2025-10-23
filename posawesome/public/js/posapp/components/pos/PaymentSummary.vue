<template>
  <div class="payment-summary">
    <div class="summary-row">
      <div class="summary-field-large">
        <label>Total Paid</label>
        <div class="field-display success-display">
          <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
          <span class="value">{{ formatCurrency(total_payments) }}</span>
        </div>
      </div>
      <div class="summary-field-small">
        <label>Remaining</label>
        <div class="field-display warning-display">
          <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
          <span class="value">{{ formatCurrency(diff_payment) }}</span>
        </div>
      </div>
    </div>

    <div class="summary-row" v-if="diff_payment < 0 && !invoice_doc.is_return">
      <div class="summary-field-large">
        <label>Remaining Amount</label>
        <div class="field-input-wrapper">
          <span class="currency-prefix">{{ currencySymbol(invoice_doc.currency) }}</span>
          <input
            type="number"
            class="compact-input readonly-input"
            v-model="paid_change"
            @input="$emit('set-paid-change')"
            readonly
          />
        </div>
      </div>
      <div class="summary-field-small">
        <label>Change Amount</label>
        <div class="field-display info-display">
          <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
          <span class="value">{{ formatCurrency(credit_change) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentSummary',
  props: {
    invoice_doc: {
      type: Object,
      default: null
    },
    total_payments: {
      type: Number,
      default: 0
    },
    diff_payment: {
      type: Number,
      default: 0
    },
    paid_change: {
      type: Number,
      default: 0
    },
    credit_change: {
      type: Number,
      default: 0
    }
  },
  emits: ['set-paid-change'],
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
.payment-summary {
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.summary-row:last-child {
  margin-bottom: 0;
}

.summary-field-large {
  flex: 2;
}

.summary-field-small {
  flex: 1;
}

.summary-field-large label,
.summary-field-small label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 4px;
}

.field-display {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: 600;
}

.success-display {
  background: #e8f5e8;
  color: #2e7d32;
}

.warning-display {
  background: #fff3e0;
  color: #f57c00;
}

.info-display {
  background: #e3f2fd;
  color: #1976d2;
}

.currency {
  font-size: 14px;
  margin-right: 4px;
}

.value {
  font-size: 16px;
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

.readonly-input {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}
</style>
