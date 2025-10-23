<template>
  <div class="payment-actions">
    <div class="action-buttons">
      <!-- Submit Payment Button -->
      <button 
        class="submit-btn"
        @click="$emit('submit-payment')"
        :disabled="!canSubmitPayment"
        :class="{ 'disabled': !canSubmitPayment }"
      >
        <i class="mdi mdi-check submit-icon"></i>
        <span class="submit-text">Submit Payment</span>
      </button>
      
      <!-- Back to Invoice Button -->
      <button 
        class="back-btn"
        @click="$emit('back-to-invoice')"
      >
        <i class="mdi mdi-arrow-left back-icon"></i>
        <span class="back-text">Back to Invoice</span>
      </button>
    </div>
    
    <!-- Payment Status -->
    <div v-if="loading" class="payment-status">
      <div class="loading-spinner"></div>
      <span class="loading-text">Processing payment...</span>
    </div>
    
    <div v-if="error" class="payment-error">
      <i class="mdi mdi-alert-circle error-icon"></i>
      <span class="error-text">{{ error }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaymentActions',
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    canSubmitPayment: {
      type: Boolean,
      default: false
    }
  },
  emits: ['submit-payment', 'back-to-invoice']
}
</script>

<style scoped>
.payment-actions {
  background: white;
  border-top: 2px solid #e0e0e0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.submit-btn {
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
  min-width: 160px;
  justify-content: center;
}

.submit-btn:hover:not(.disabled) {
  background: #45a049;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.submit-btn.disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 160px;
  justify-content: center;
}

.back-btn:hover {
  background: #eeeeee;
  border-color: #bbb;
}

.submit-icon,
.back-icon {
  font-size: 16px;
}

.submit-text,
.back-text {
  font-weight: 600;
}

.payment-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: #e3f2fd;
  border-radius: 4px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e3f2fd;
  border-top: 2px solid #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: #1976d2;
  font-weight: 500;
}

.payment-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: #ffebee;
  border-radius: 4px;
}

.error-icon {
  font-size: 16px;
  color: #f44336;
}

.error-text {
  font-size: 14px;
  color: #f44336;
  font-weight: 500;
}
</style>
