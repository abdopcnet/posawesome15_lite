<template>
  <!-- ===== COMPACT PAYMENTS COMPONENT ===== -->
  <div class="payments-container">
    <!-- Fixed Back Button -->
    <button class="back-button-fixed" @click="back_to_invoice" :title="__('Back to Invoice')">
      <i class="mdi mdi-arrow-left back-icon"></i>
      <span class="back-text">{{ __("Back") }}</span>
    </button>

    <div class="card payments-card" style="max-height: 76vh; height: 76vh">
      <div v-if="loading" class="custom-progress-linear">
        <div class="progress-bar"></div>
      </div>

      <div class="payments-scroll" style="max-height: 75vh">
        <!-- Payment Summary Section -->
        <div v-if="invoice_doc" class="payment-summary">
          <div class="summary-row">
            <div class="summary-field-large">
              <label>{{ __("Total Paid") }}</label>
              <div class="field-display success-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatCurrency(total_payments) }}</span>
              </div>
            </div>
            <div class="summary-field-small">
              <label>{{ __("Remaining") }}</label>
              <div class="field-display warning-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatCurrency(diff_payment) }}</span>
              </div>
            </div>
          </div>

          <div class="summary-row" v-if="diff_payment < 0 && !invoice_doc.is_return">
            <div class="summary-field-large">
              <label>{{ __("Remaining Amount") }}</label>
              <div class="field-input-wrapper">
                <span class="currency-prefix">{{ currencySymbol(invoice_doc.currency) }}</span>
                <input type="number" class="compact-input readonly-input" v-model="paid_change"
                  @input="set_paid_change()" readonly />
              </div>
            </div>
            <div class="summary-field-small">
              <label>{{ __("Change Amount") }}</label>
              <div class="field-display info-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatCurrency(credit_change) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section-divider"></div>

        <!-- Payment Methods Section -->
        <div v-if="is_cashback" class="payment-methods">
          <div class="payment-method-row" v-for="payment in invoice_doc.payments" :key="payment.name">
            <div class="payment-amount">
              <label>{{ __("Amount") }}</label>
              <div class="field-input-wrapper">
                <span class="currency-prefix">{{ currencySymbol(invoice_doc.currency) }}</span>
                <input type="text" class="compact-input" :value="formatCurrency(payment.amount)"
                  @change="setFormatedCurrency(payment, 'amount', null, true, $event)"
                  @focus="set_rest_amount(payment.idx)" :readonly="invoice_doc.is_return ? true : false"
                  placeholder="0.00" />
              </div>
            </div>
            <button class="payment-method-btn"
              :class="{ 'has-request': payment.type == 'Phone' && payment.amount > 0 && request_payment_field }"
              @click="set_full_amount(payment.idx)">
              {{ payment.mode_of_payment }}
            </button>
            <button v-if="payment.type == 'Phone' && payment.amount > 0 && request_payment_field" class="request-btn"
              :disabled="payment.amount == 0" @click="(phone_dialog = true), (payment.amount = flt(payment.amount, 0))">
              {{ __("Request") }}
            </button>
          </div>
        </div>

        <!-- Loyalty Points Section -->
        <div class="payment-loyalty" v-if="invoice_doc && available_pioints_amount > 0 && !invoice_doc.is_return">
          <div class="loyalty-row">
            <div class="loyalty-field-large">
              <label>{{ __("Pay from Customer Points") }}</label>
              <div class="field-input-wrapper">
                <span class="currency-prefix">{{ currencySymbol(invoice_doc.currency) }}</span>
                <input type="number" class="compact-input" v-model="loyalty_amount" placeholder="0.00" />
              </div>
            </div>
            <div class="loyalty-field-small">
              <label>{{ __("Customer Points Balance") }}</label>
              <div class="field-display disabled-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatFloat(available_pioints_amount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer Credit Section -->
        <div class="payment-credit"
          v-if="invoice_doc && available_customer_credit > 0 && !invoice_doc.is_return && redeem_customer_credit">
          <div class="credit-row">
            <div class="credit-field-large">
              <label>{{ __("Customer Credit Redeemed") }}</label>
              <div class="field-display disabled-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatCurrency(redeemed_customer_credit) }}</span>
              </div>
            </div>
            <div class="credit-field-small">
              <label>{{ __("Cash Credit Balance") }}</label>
              <div class="field-display disabled-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatCurrency(available_customer_credit) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="section-divider"></div>

        <!-- Options Section (Switches) -->
        <div class="payment-options">
          <div class="option-switch"
            v-if="pos_profile.posa_allow_write_off_change && diff_payment > 0 && !invoice_doc.is_return">
            <label class="custom-switch">
              <input type="checkbox" v-model="is_write_off_change" />
              <span class="switch-slider"></span>
              <span class="switch-label">{{ __("Is Write Off Amount?") }}</span>
            </label>
          </div>
          <div class="option-switch" v-if="pos_profile.posa_allow_credit_sale && !invoice_doc.is_return">
            <label class="custom-switch">
              <input type="checkbox" v-model="is_credit_sale" />
              <span class="switch-slider"></span>
              <span class="switch-label">{{ __("Is Credit Sale?") }}</span>
            </label>
          </div>
          <div class="option-switch" v-if="!invoice_doc.is_return && pos_profile.posa_use_customer_credit">
            <label class="custom-switch">
              <input type="checkbox" v-model="redeem_customer_credit"
                @change="get_available_credit($event.target.checked)" />
              <span class="switch-slider"></span>
              <span class="switch-label">{{ __("Use Customer Credit") }}</span>
            </label>
          </div>
          <div class="option-switch" v-if="invoice_doc.is_return && pos_profile.posa_use_cashback">
            <label class="custom-switch">
              <input type="checkbox" v-model="is_cashback" />
              <span class="switch-slider"></span>
              <span class="switch-label">{{ __("Is Cash Return?") }}</span>
            </label>
          </div>
          <div class="option-date" v-if="is_credit_sale">
            <label>{{ __("Due Date") }}</label>
            <div class="text-field-wrapper">
              <input type="date" class="custom-text-field date-field" v-model="invoice_doc.due_date"
                :min="frappe.datetime.now_date()" placeholder="Select date" />
            </div>
          </div>

        </div>

        <!-- Credit Details Section -->
        <div class="credit-details"
          v-if="invoice_doc && available_customer_credit > 0 && !invoice_doc.is_return && redeem_customer_credit">
          <div class="credit-detail-row" v-for="(row, idx) in customer_credit_dict" :key="idx">
            <div class="credit-origin">
              {{ row.credit_origin }}
            </div>
            <div class="credit-available">
              <label>{{ __("Available Credit") }}</label>
              <div class="field-display disabled-display">
                <span class="currency">{{ currencySymbol(invoice_doc.currency) }}</span>
                <span class="value">{{ formatCurrency(row.total_credit) }}</span>
              </div>
            </div>
            <div class="credit-redeem">
              <label>Credit to Redeem</label>
              <div class="field-input-wrapper">
                <span class="currency-prefix">{{ currencySymbol(invoice_doc.currency) }}</span>
                <input type="number" class="compact-input" v-model="row.credit_to_redeem" placeholder="0.00" />
              </div>
            </div>
          </div>
        </div>

        <div class="section-divider"></div>
      </div>
    </div>

    <!-- Phone Dialog -->
    <div v-if="phone_dialog" class="custom-modal-overlay" @click="phone_dialog = false">
      <div class="custom-modal" @click.stop>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Confirm Phone Number</span>
            <button class="modal-close-btn" @click="phone_dialog = false">×</button>
          </div>
          <div class="card-body">
            <div class="form-container">
              <div class="text-field-wrapper">
                <label class="text-field-label">Phone Number</label>
                <input type="number" class="custom-text-field" v-model="invoice_doc.contact_mobile"
                  placeholder="Enter phone number" />
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div class="spacer"></div>
            <button class="btn btn-error" @click="phone_dialog = false">Close</button>
            <button class="btn btn-primary" @click="request_payment">Request</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./Payments.js" />

<style scoped>
/* SHARED LABEL STYLES */
.summary-field-large label,
.summary-field-small label,
.payment-amount label,
.loyalty-field-large label,
.loyalty-field-small label,
.credit-field-large label,
.credit-field-small label,
.credit-available label,
.credit-redeem label,
.option-date label {
  font-size: 0.6rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 0;
  padding: 0 2px;
  line-height: 1;
}

/* CONTAINER STYLES */
.payments-container {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Card Components */
.card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
}

.card-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1976d2;
}

.card-body {
  padding: 16px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
}

/* Spacer */
.spacer {
  flex: 1;
}

/* Form Container */
.form-container {
  padding: 0;
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
  line-height: 1.5;
  margin: 0 4px;
}

.btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
  border-color: #1565c0;
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
}

.btn-error {
  background: linear-gradient(135deg, #f44336 0%, #e53935 100%);
  border-color: #d32f2f;
  color: white;
}

.btn-error:hover {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
}

.payments-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%) !important;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.payments-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px;
}

/* Professional Scrollbar */
.payments-scroll::-webkit-scrollbar {
  width: 6px;
}

.payments-scroll::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.payments-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 3px;
}

.payments-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
}

/* Section Divider */
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
  margin: 4px 0;
}

/* BACK BUTTON */
.back-button-fixed {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(25, 118, 210, 0.3);
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.back-button-fixed:hover {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(25, 118, 210, 0.4);
}

.back-button-fixed:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(25, 118, 210, 0.3);
}

.back-icon {
  color: white;
  font-size: 18px;
}

.back-button-fixed:hover .back-icon {
  transform: translateX(-2px);
}

.back-text {
  white-space: nowrap;
  line-height: 1;
}

/* SHARED ROW LAYOUT */
.summary-row,
.loyalty-row,
.credit-row {
  display: flex;
  gap: 3px;
  align-items: flex-start;
}

.summary-field-large,
.loyalty-field-large,
.credit-field-large {
  flex: 1.4;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-field-small,
.loyalty-field-small,
.credit-field-small {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* FIELD DISPLAY STYLES (SHARED) */
.field-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  background: white;
  min-height: 22px;
  transition: all 0.2s ease;
}

.field-display .currency {
  font-size: 0.6rem;
  font-weight: 600;
  color: #666;
  margin-right: 3px;
}

.field-display .value {
  font-size: 0.7rem;
  font-weight: 700;
  color: #333;
  flex: 1;
  text-align: right;
}

/* Display Variants */
.success-display {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-color: #4caf50;
}

.success-display .value {
  color: #2e7d32;
}

.warning-display {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-color: #ff9800;
}

.warning-display .value {
  color: #e65100;
}

.info-display {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #2196f3;
}

.info-display .value {
  color: #0d47a1;
}

.disabled-display {
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  border-color: #bdbdbd;
  opacity: 0.8;
}

.disabled-display .value {
  color: #757575;
}

/* FIELD INPUT WRAPPER (SHARED) */
.field-input-wrapper {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #1976d2;
  border-radius: 3px;
  padding: 1px 4px;
  min-height: 22px;
  transition: all 0.2s ease;
}

.field-input-wrapper:hover {
  border-color: #1565c0;
  box-shadow: 0 1px 3px rgba(25, 118, 210, 0.15);
}

.field-input-wrapper:focus-within {
  border-color: #0d47a1;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.12);
  background: #e3f2fd;
}

.currency-prefix {
  font-size: 0.6rem;
  font-weight: 600;
  color: #1976d2;
  margin-right: 3px;
  flex-shrink: 0;
}

.compact-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.7rem;
  font-weight: 700;
  color: #1976d2;
  text-align: right;
  padding: 1px;
  min-width: 0;
  line-height: 1.2;
}

.compact-input::placeholder {
  color: #90caf9;
  opacity: 0.6;
}

.compact-input::-webkit-inner-spin-button,
.compact-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.compact-input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.readonly-input {
  color: #757575;
  cursor: not-allowed;
}

/* SECTION-SPECIFIC STYLES */
.payment-summary {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 2px;
}

.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 2px 0;
}

.payment-loyalty {
  margin: 3px 0;
}

.payment-credit {
  margin: 3px 0;
}

.payment-options {
  display: flex;
  gap: 4px;
  margin: 3px 0;
  padding: 4px;
  background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%);
  border-radius: 4px;
}

.credit-details {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 3px 0;
  padding: 4px;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-radius: 4px;
  border: 1px solid #ff9800;
}

/* PAYMENT METHOD ROW */
.payment-method-row {
  display: flex;
  gap: 3px;
  align-items: flex-end;
}

.payment-amount {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.payment-method-btn {
  flex: 1;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(25, 118, 210, 0.25);
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
}

.payment-method-btn:hover {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.35);
}

.payment-method-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(25, 118, 210, 0.25);
}

.payment-method-btn.has-request {
  flex: 0.7;
}

.request-btn {
  flex: 0.4;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(76, 175, 80, 0.25);
  transition: all 0.2s ease;
}

.request-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.35);
}

.request-btn:disabled {
  background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%);
  color: #9e9e9e;
  cursor: not-allowed;
  opacity: 0.6;
}

/* SWITCHES AND OPTIONS */
.option-switch {
  flex: 1 1 calc(50% - 2px);
  min-width: 130px;
}

.option-date {
  flex: 1 1 calc(50% - 2px);
  min-width: 130px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.compact-switch :deep(.v-label) {
  font-size: 0.65rem !important;
  color: #666 !important;
  line-height: 1.2 !important;
}

.compact-switch :deep(.v-input__control) {
  min-height: 20px !important;
}

.compact-switch :deep(.v-selection-control) {
  min-height: 20px !important;
}

.compact-date-field :deep(.v-field__input) {
  min-height: 22px !important;
  padding: 1px 6px !important;
  font-size: 0.7rem !important;
}

.compact-date-field :deep(.v-field) {
  min-height: 22px !important;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* CREDIT DETAILS */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

.credit-details label {
  font-size: 0.6rem;
  font-weight: 600;
  color: #e65100;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 0 2px;
  line-height: 1;
}

.credit-detail-row {
  display: flex;
  gap: 3px;
  align-items: center;
}

.credit-origin {
  flex: 0.8;
  font-size: 0.7rem;
  font-weight: 600;
  color: #e65100;
  padding: 3px 6px;
  background: white;
  border-radius: 3px;
  border: 1px solid #ffcc80;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.credit-available {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.credit-redeem {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* RESPONSIVE DESIGN */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

@media (max-width: 768px) {

  .summary-row,
  .loyalty-row,
  .credit-row {
    flex-direction: column;
  }

  .summary-field-large,
  .summary-field-small,
  .loyalty-field-large,
  .loyalty-field-small,
  .credit-field-large,
  .credit-field-small {
    flex: 1;
  }

  .payment-method-row {
    flex-wrap: wrap;
  }

  .payment-amount {
    flex: 1 1 100%;
  }

  .payment-method-btn,
  .request-btn {
    flex: 1 1 calc(50% - 2px);
  }

  .option-switch,
  .option-date {
    flex: 1 1 100%;
  }
}

/* ===== CUSTOM TEXT FIELD ===== */
.text-field-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.text-field-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 2px;
}

.custom-text-field {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #333;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  outline: none;
  transition: all 0.2s ease;
}

.custom-text-field:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.custom-text-field:hover:not(:disabled):not(:focus) {
  border-color: #999;
}

.custom-text-field:disabled,
.custom-text-field:read-only {
  background: #f5f5f5;
  cursor: not-allowed;
  color: #666;
}

.custom-text-field.date-field {
  cursor: pointer;
}

.custom-text-field.date-field:read-only {
  cursor: pointer;
  background: white;
}

.custom-text-field::placeholder {
  color: #999;
  font-size: 0.8rem;
}

/* Compact variant */
.custom-text-field.compact {
  padding: 6px 10px;
  font-size: 0.8rem;
}

/* Error state */
.text-field-wrapper.error .custom-text-field {
  border-color: #f44336;
}

.text-field-wrapper.error .text-field-label {
  color: #f44336;
}

/* ===== CUSTOM SWITCH ===== */
.custom-switch {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  user-select: none;
  gap: 12px;
}

.custom-switch input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background: #ccc;
  border-radius: 24px;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.switch-slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.custom-switch input[type="checkbox"]:checked+.switch-slider {
  background: #1976d2;
}

.custom-switch input[type="checkbox"]:checked+.switch-slider::before {
  transform: translateX(20px);
}

.custom-switch input[type="checkbox"]:focus+.switch-slider {
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.custom-switch:hover .switch-slider {
  opacity: 0.9;
}

.custom-switch input[type="checkbox"]:disabled+.switch-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch-label {
  font-size: 0.85rem;
  color: #333;
  font-weight: 500;
}

.custom-switch input[type="checkbox"]:disabled~.switch-label {
  color: #999;
}

/* Compact variant */
.custom-switch.compact .switch-slider {
  width: 36px;
  height: 20px;
}

.custom-switch.compact .switch-slider::before {
  height: 14px;
  width: 14px;
}

.custom-switch.compact input[type="checkbox"]:checked+.switch-slider::before {
  transform: translateX(16px);
}

.custom-switch.compact .switch-label {
  font-size: 0.8rem;
}

/* ===== CUSTOM PROGRESS LINEAR ===== */
.custom-progress-linear {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #e0e0e0;
  overflow: hidden;
  z-index: 10;
}

.custom-progress-linear .progress-bar {
  height: 100%;
  background: #1976d2;
  animation: progress-indeterminate 1.5s infinite linear;
  transform-origin: 0% 50%;
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(0) scaleX(0);
  }

  40% {
    transform: translateX(0) scaleX(0.4);
  }

  100% {
    transform: translateX(100%) scaleX(0.5);
  }
}

/* Thin variant for search */
.custom-progress-linear.search-progress {
  height: 2px;
}

/* ===== CUSTOM MODAL ===== */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: modal-fade-in 0.2s ease;
}

.custom-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  animation: modal-slide-in 0.3s ease;
}

.modal-close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

@keyframes modal-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes modal-slide-in {
  from {
    transform: translateY(-20px) scale(0.95);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* Responsive modal */
@media (max-width: 600px) {
  .custom-modal {
    width: 95%;
    margin: 20px;
  }
}
</style>
