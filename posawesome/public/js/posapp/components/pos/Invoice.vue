<template>
  <div>
    <div class="cards py-0 grey lighten-5 d-flex flex-column flex-grow-1" style="min-height: 0">
      <!-- Compact Customer Section -->
      <div class="compact-customer-section">
        <Customer></Customer>
      </div>

      <div class="my-0 py-0 invoice-items-scrollable">
        <table class="invoice-table elevation-0" style="min-width: 600px; max-width: 100%">
          <thead>
            <tr>
              <th v-for="header in dynamicHeaders" :key="header.key"
                :style="{ width: header.width, textAlign: header.align }" class="table-header-cell">
                {{ header.title }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.posa_row_id" class="table-row">
              <!-- Item Name Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'item_name')" class="table-cell">
                <div style="width: 120px">
                  <p class="mb-0">{{ item.item_name }}</p>
                </div>
              </td>

              <!-- Quantity Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'qty')" class="table-cell">
                <div class="compact-qty-controls">
                  <button class="qty-btn minus-btn" @click="decreaseQuantity(item)"
                    :disabled="!(item.qty && item.qty > 0)" type="button">
                    <span class="btn-icon">−</span>
                  </button>
                  <input type="number" v-model.number="item.qty" @input="onQtyInput(item)" @change="onQtyChange(item)"
                    @blur="onQtyChange(item)" class="compact-qty-input" placeholder="0" />
                  <button class="qty-btn plus-btn" @click="increaseQuantity(item)" type="button">
                    <span class="btn-icon">+</span>
                  </button>
                </div>
              </td>

              <!-- UOM Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'uom')" class="table-cell">
                {{ item.uom }}
              </td>

              <!-- Price List Rate Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'price_list_rate')" class="table-cell">
                <div class="compact-price-display">
                  <span class="amount-value">
                    {{ formatCurrency(item.price_list_rate) }}
                  </span>
                </div>
              </td>

              <!-- Rate (Discounted Price) Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'rate')" class="table-cell">
                <div class="compact-rate-wrapper">
                  <input type="text" :value="formatCurrency(item.rate)" @change="setItemRate(item, $event)"
                    @blur="setItemRate(item, $event)" @keyup.enter="setItemRate(item, $event)" :disabled="Boolean(
                      item.posa_is_offer ||
                      item.posa_is_replace ||
                      item.posa_offer_applied ||
                      invoice_doc?.is_return
                    )
                      " class="compact-rate-input" placeholder="0.00" />
                </div>
              </td>

              <!-- Discount Percentage Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'discount_percentage')" class="table-cell">
                <div class="compact-discount-wrapper" :class="{ 'has-discount': item.discount_percentage > 0 }">
                  <input type="number" :value="formatFloat(item.discount_percentage || 0)"
                    @change="setDiscountPercentage(item, $event)" @blur="setDiscountPercentage(item, $event)"
                    @keyup.enter="setDiscountPercentage(item, $event)" :disabled="Boolean(
                      item.posa_is_offer ||
                      item.posa_is_replace ||
                      item.posa_offer_applied ||
                      !pos_profile?.posa_allow_user_to_edit_item_discount ||
                      invoice_doc?.is_return
                    )
                      " class="compact-discount-input" placeholder="0" min="0"
                    :max="pos_profile?.posa_item_max_discount_allowed || 100" step="0.01" />
                  <span class="discount-suffix">%</span>
                </div>
              </td>

              <!-- Discount Amount Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'discount_amount')" class="table-cell">
                <div class="compact-discount-amount">
                  <span class="amount-value" :class="{ 'has-value': getDiscountAmount(item) > 0 }">
                    {{ formatCurrency(getDiscountAmount(item)) }}
                  </span>
                </div>
              </td>

              <!-- Total Amount Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'amount')" class="table-cell">
                <div class="compact-total-amount">
                  <span class="amount-value">
                    {{
                      formatCurrency(
                        flt(item.qty, float_precision) *
                        flt(item.rate, currency_precision)
                      )
                    }}
                  </span>
                </div>
              </td>

              <!-- Actions Column -->
              <td v-if="dynamicHeaders.find(h => h.key === 'actions')" class="table-cell">
                <div class="flex justify-end">
                  <button :disabled="Boolean(item.posa_is_offer || item.posa_is_replace)"
                    class="delete-item-btn error-btn-small" @click.stop="remove_item(item)" title="Delete item">
                    <i class="mdi mdi-delete"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div> <!-- Compact Payment Controls Card -->
    <div class="payment-controls-card">
      <!-- Financial Summary Row -->
      <div class="financial-summary">
        <div class="summary-field readonly-field">
          <label>{{ $translationTrigger ? __("Total Qty") : "Total Qty" }}</label>
          <div class="field-value">
            {{ formatFloat(invoice_doc?.total_qty || 0) }}
          </div>
        </div>

        <div class="summary-field editable-field">
          <label>{{ __("inv_disc") }}</label>
          <input type="number" :value="additional_discount_percentage" @input="onDiscountInput" @blur="onDiscountBlur"
            ref="percentage_discount" step="0.01" min="0" :max="pos_profile?.posa_invoice_max_discount_allowed || 100"
            class="field-input discount-input" placeholder="0.00"
            :disabled="!pos_profile?.posa_allow_user_to_edit_additional_discount" />
        </div>

        <div class="summary-field readonly-field warning-field">
          <label>{{ __("items_dis") }}</label>
          <div class="field-value">
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(invoice_doc?.posa_item_discount_total || 0) }}
          </div>
        </div>

        <div class="summary-field readonly-field">
          <label>{{ __("before_disc") }}</label>
          <div class="field-value">
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(invoice_doc?.total || 0) }}
          </div>
        </div>

        <div class="summary-field readonly-field">
          <label>{{ __("net_total") }}</label>
          <div class="field-value">
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(invoice_doc?.net_total || 0) }}
          </div>
        </div>

        <div class="summary-field readonly-field info-field">
          <label>{{ __("Tax") }}</label>
          <div class="field-value">
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(computedTaxAmount) }}
          </div>
        </div>

        <div class="summary-field readonly-field success-field grand-total">
          <label>{{ __("grand_total") }}</label>
          <div class="field-value">
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(invoice_doc?.grand_total || 0) }}
          </div>
        </div>
      </div>

      <!-- Action Buttons Row -->
      <div class="action-buttons">
        <button class="action-btn primary-btn" :disabled="!hasItems" @click="printInvoice" :title="__('Print invoice')">
          <i class="mdi mdi-printer action-icon"></i>
          <span>{{ $translationTrigger ? __("Print") : "Print" }}</span>
        </button>

        <button class="action-btn success-btn" :disabled="!hasItems || is_payment || isUpdatingTotals"
          @click="show_payment">
          <i class="mdi mdi-cash-multiple action-icon"></i>
          <span>{{ $translationTrigger ? __("Pay") : "Pay" }}</span>
        </button>

        <button class="action-btn secondary-btn" :disabled="!pos_profile?.posa_allow_return" @click="open_returns">
          <i class="mdi mdi-keyboard-return action-icon"></i>
          <span>{{ $translationTrigger ? __("Return") : "Return" }}</span>
        </button>

        <button class="action-btn purple-btn" :disabled="!pos_profile?.posa_allow_quick_return" @click="quick_return">
          <i class="mdi mdi-flash action-icon"></i>
          <span>{{ $translationTrigger ? __("Quick Return") : "Quick Return" }}</span>
        </button>

        <button class="action-btn error-btn" @click="cancel_invoice">
          <i class="mdi mdi-close-circle action-icon"></i>
          <span>{{ $translationTrigger ? __("Cancel") : "Cancel" }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script src="./Invoice.js" />

<style scoped>
/* .border_line_bottom {
    border-bottom: 1px solid lightgray;
  } */

.disable-events {
  pointer-events: none;
}

/* ===== COMPACT CUSTOMER SECTION ===== */
.compact-customer-section {
  padding: 4px 6px;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 0;
}

/* Old customer container - keep for compatibility */
.customer-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 10px;
}

/* Invoice number display styling */
.invoice-number-display {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f5f5f5;
  height: 100%;
  min-height: 56px;
  font-size: 14px;
}

.invoice-number-text {
  flex: 1;
  font-weight: bold;
  line-height: 1.2;
}

/* Regular invoice styling - dark blue */
.regular-invoice .invoice-number-text {
  color: #1976d2 !important;
  font-weight: bold !important;
}

/* Return invoice styling - dark red */
.return-invoice .invoice-number-text {
  color: #d32f2f !important;
  font-weight: bold !important;
}

/* No invoice styling - italic gray */
.no-invoice .invoice-number-text {
  color: #757575 !important;
  font-weight: normal !important;
  font-style: italic !important;
}

/* Sales Invoice Mode - Green Bold */
.sales-invoice-mode .invoice-number-text {
  color: #4caf50 !important;
  font-weight: bold !important;
}

/* Quick Return Mode - Purple Bold */
.quick-return-mode .invoice-number-text {
  color: #9c27b0 !important;
  font-weight: bold !important;
}

/* Return Invoice Mode - Grey Bold */
.return-invoice-mode .invoice-number-text {
  color: #757575 !important;
  font-weight: bold !important;
}

/* Global compact styling to match 75% zoom appearance */
.v-application {
  font-size: 0.75rem !important;
}

.v-btn {
  font-size: 0.7rem !important;
  padding: 4px 8px !important;
  min-height: 24px !important;
}

.v-text-field {
  font-size: 0.7rem !important;
}

.v-text-field .v-field {
  min-height: 28px !important;
}

.v-text-field .v-field__input {
  padding: 4px 8px !important;
  font-size: 0.7rem !important;
}

.v-data-table {
  font-size: 0.7rem !important;
  overflow: auto !important;
}

.v-data-table .v-data-table__wrapper table {
  font-size: 0.75rem !important;
}

/* Consistent table formatting */
.v-data-table .v-data-table__wrapper table th,
.v-data-table .v-data-table__wrapper table td {
  padding: 4px 6px !important;
  font-size: 0.75rem !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
}

.v-data-table .v-data-table__wrapper table th {
  font-weight: 600 !important;
  font-size: 0.8rem !important;
  background-color: #f5f5f5 !important;
  height: 28px !important;
}

/* RTL text direction for item name column */
.v-data-table .v-data-table__wrapper table th:last-child,
.v-data-table .v-data-table__wrapper table td:last-child {
  text-align: right !important;
  direction: rtl !important;
}

/* ===== PROFESSIONAL COMPACT TABLE DESIGN ===== */
.invoice-items-scrollable {
  border-collapse: collapse;
  flex: 1 1 auto !important;
  max-height: calc(100vh - 170px) !important;
  overflow-y: auto !important;
  overflow-x: auto !important;
}

/* Ultra-compact table layout */
.invoice-items-scrollable .v-data-table__wrapper table {
  table-layout: auto !important;
  width: 100% !important;
  min-width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  border-spacing: 0 !important;
  border-collapse: collapse !important;
  overflow: auto;
}

/* Zero spacing table cells with borders */
.invoice-items-scrollable .v-data-table__wrapper table th,
.invoice-items-scrollable .v-data-table__wrapper table td {
  white-space: normal !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  box-sizing: border-box !important;
  font-size: 0.7rem !important;
  margin: 0 !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  line-height: 1.1 !important;
  padding: 2px 4px !important;
  border-collapse: collapse !important;
}

/* Item name column takes remaining space */
.invoice-items-scrollable .v-data-table__wrapper table th:last-child,
.invoice-items-scrollable .v-data-table__wrapper table td:last-child {
  white-space: normal !important;
  word-wrap: break-word !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  text-overflow: clip !important;
  overflow-wrap: break-word !important;
}

/* Completely remove scrollbars */
.invoice-items-scrollable .v-data-table__wrapper {
  overflow-x: hidden !important;
  overflow-y: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  max-height: calc(100vh - 170px) !important;
  box-sizing: border-box !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
}

/* Ultra-compact spacing - Professional */
.invoice-items-scrollable .v-data-table__wrapper table {
  border-spacing: 0 !important;
  border-collapse: collapse !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  table-layout: auto !important;
}

.invoice-items-scrollable .v-data-table__wrapper table tr td,
.invoice-items-scrollable .v-data-table__wrapper table tr th {
  margin: 0 !important;
  padding: 1px 1px !important;
  border: none !important;
  box-sizing: border-box !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  line-height: 1.1 !important;
}

/* Additional fixes for container distortion */
.invoice-items-scrollable .v-data-table {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  border: none !important;
  flex: 1 1 auto !important;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
  border: 1px solid #ccc !important;
}

/* Remove any borders from table wrapper only - NOT from cells */
.invoice-items-scrollable .v-data-table,
.invoice-items-scrollable .v-data-table__wrapper {
  border: none !important;
  outline: none !important;
}

.invoice-items-scrollable .v-data-table .v-data-table__wrapper {
  max-width: 100%px !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
}

/* Ensure proper column distribution */
.invoice-items-scrollable .v-data-table__wrapper table colgroup col {
  width: auto !important;
}

/* Fix for item name column */
.invoice-items-scrollable .v-data-table__wrapper table th:last-child,
.invoice-items-scrollable .v-data-table__wrapper table td:last-child {
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  flex: 1 !important;
}

/* Compact Quantity Controls Container */
.compact-qty-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  padding: 2px;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 4px;
  width: 100%;
  max-width: 85px;
  min-width: 75px;
}

.compact-qty-controls:hover {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.2);
}

/* Compact Quantity Input */
.compact-qty-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  border: 1px solid #1976d2;
  background: white;
  outline: none;
  font-size: 0.75rem;
  font-weight: 700;
  color: #1976d2;
  text-align: center;
  padding: 2px 4px;
  border-radius: 3px;
  line-height: 1.2;
  height: 20px;
  appearance: textfield;
  -moz-appearance: textfield;
}

.compact-qty-input::-webkit-inner-spin-button,
.compact-qty-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.compact-qty-input:focus {
  border-color: #0d47a1;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
  background: #e3f2fd;
}

.compact-qty-input:hover {
  border-color: #1565c0;
  background: #f5f5f5;
}

.compact-qty-input::placeholder {
  color: #bbb;
  font-weight: 400;
}

/* Compact Quantity Buttons */
.qty-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  min-width: 20px;
  padding: 0;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.qty-btn .btn-icon {
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
  display: block;
}

/* Minus Button - Orange/Warning */
.qty-btn.minus-btn {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
}

.qty-btn.minus-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #f57c00 0%, #e65100 100%);
  box-shadow: 0 2px 6px rgba(245, 124, 0, 0.4);
}

.qty-btn.minus-btn:active:not(:disabled) {
  box-shadow: 0 1px 2px rgba(245, 124, 0, 0.3);
}

.qty-btn.minus-btn:disabled {
  background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%);
  color: #9e9e9e;
  cursor: not-allowed;
  box-shadow: none;
  opacity: 0.6;
}

/* Plus Button - Green/Success */
.qty-btn.plus-btn {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
}

.qty-btn.plus-btn:hover {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
  box-shadow: 0 2px 6px rgba(56, 142, 60, 0.4);
}

.qty-btn.plus-btn:active {
  box-shadow: 0 1px 2px rgba(56, 142, 60, 0.3);
}

/* Ultra-compact delete button */
.delete-item-btn {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  line-height: 1 !important;
  padding: 0 !important;
  border-radius: 2px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: none !important;
}

.delete-item-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.delete-item-btn:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.1);
}

.delete-item-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-item-btn .mdi {
  font-size: 12px;
  color: #f44336;
}

.error-btn-small {
  background: transparent;
  border: none;
  color: #f44336;
}

/* Compact Rate Input Field */
.compact-rate-wrapper {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #1976d2;
  border-radius: 4px;
  min-width: 70px;
  max-width: 90px;
}

.compact-rate-wrapper:hover {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #1565c0;
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.2);
}

.compact-rate-wrapper:focus-within {
  border-color: #0d47a1;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
  background: white;
}

.currency-prefix {
  font-size: 0.65rem;
  font-weight: 700;
  color: #1976d2;
  white-space: nowrap;
  flex-shrink: 0;
}

.compact-rate-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1976d2;
  text-align: right;
  padding: 2px 4px;
  line-height: 1.2;
}

.compact-rate-input:disabled {
  color: #999;
  cursor: not-allowed;
  opacity: 0.6;
}

.compact-rate-input::placeholder {
  color: #bbb;
  font-weight: 400;
}

/* Compact Discount Input Field */
.compact-discount-wrapper {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #1976d2;
  border-radius: 4px;
  min-width: 55px;
  max-width: 75px;
}

.compact-discount-wrapper.has-discount {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-color: #ff9800;
}

.compact-discount-wrapper:hover {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #1565c0;
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.2);
}

.compact-discount-wrapper.has-discount:hover {
  background: linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%);
  border-color: #f57c00;
  box-shadow: 0 1px 4px rgba(255, 152, 0, 0.3);
}

.compact-discount-wrapper:focus-within {
  border-color: #0d47a1;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
  background: white;
}

.compact-discount-wrapper.has-discount:focus-within {
  border-color: #e65100;
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.15);
}

.compact-discount-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1976d2;
  text-align: right;
  padding: 2px 2px;
  line-height: 1.2;
  appearance: textfield;
  -moz-appearance: textfield;
}

.compact-discount-wrapper.has-discount .compact-discount-input {
  color: #f57c00;
  font-weight: 700;
}

.compact-discount-input::-webkit-inner-spin-button,
.compact-discount-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.compact-discount-input:disabled {
  color: #999;
  cursor: not-allowed;
  opacity: 0.6;
}

.compact-discount-input::placeholder {
  color: #bbb;
  font-weight: 400;
}

.discount-suffix {
  font-size: 0.65rem;
  font-weight: 700;
  color: #1976d2;
  white-space: nowrap;
  flex-shrink: 0;
}

.compact-discount-wrapper.has-discount .discount-suffix {
  color: #f57c00;
}

/* Compact Discount Amount Display */
.compact-discount-amount {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
  border-radius: 4px;
  min-width: 60px;
}

.compact-discount-amount .amount-currency {
  font-size: 0.65rem;
  font-weight: 600;
  color: #666;
}

.compact-discount-amount .amount-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: #757575;
}

.compact-discount-amount .amount-value.has-value {
  color: #ff9800;
  font-weight: 700;
}

.compact-discount-amount:hover .amount-value.has-value {
  color: #f57c00;
}

/* Compact Total Amount Display */
.compact-total-amount {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-radius: 4px;
  border: 1px solid #4caf50;
  min-width: 70px;
}

.compact-total-amount:hover {
  background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
  border-color: #388e3c;
  box-shadow: 0 1px 4px rgba(76, 175, 80, 0.3);
}

.compact-total-amount .amount-currency {
  font-size: 0.65rem;
  font-weight: 700;
  color: #2e7d32;
}

.compact-total-amount .amount-value {
  font-size: 0.8rem;
  font-weight: 700;
  color: #1b5e20;
}

/* Compact Price Display */
.compact-price-display {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
  border-radius: 4px;
  min-width: 65px;
}

.compact-price-display:hover {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  box-shadow: 0 1px 3px rgba(25, 118, 210, 0.2);
}

.compact-price-display .amount-currency {
  font-size: 0.65rem;
  font-weight: 600;
  color: #1976d2;
}

.compact-price-display .amount-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: #1976d2;
}

.compact-price-display .amount-value.discounted-price {
  color: #f44336;
  font-weight: 700;
  text-decoration: line-through;
  text-decoration-color: #f44336;
  text-decoration-thickness: 2px;
}

/* Optimized buttons in payment section for cashier screens */
.cards.mb-0.mt-3.py-1.px-0.grey.lighten-5 .v-btn {
  font-size: 0.75rem !important;
  padding: 6px 12px !important;
  min-height: 28px !important;
}

/* Optimized text fields in payment section */
.cards.mb-0.mt-3.py-1.px-0.grey.lighten-5 .v-text-field .v-field {
  min-height: 30px !important;
}

.cards.mb-0.mt-3.py-1.px-0.grey.lighten-5 .v-text-field .v-field__input {
  padding: 6px 10px !important;
  font-size: 0.8rem !important;
}

/* Ensure invoice discount field is editable */
.cards.mb-0.mt-3.py-1.px-0.grey.lighten-5 .v-text-field input[type="number"] {
  pointer-events: auto !important;
  cursor: text !important;
}

@media (max-width: 1280px) {

  .quantity-input,
  .rate-input,
  .discount-input {
    max-height: 20px !important;
    min-height: 20px !important;
    font-size: 0.7rem !important;
  }

  .quantity-btn {
    min-width: 18px !important;
    width: 18px !important;
    height: 18px !important;
    font-size: 0.7rem !important;
  }
}

/* ===== PAYMENT CONTROLS CARD - COMPACT & PROFESSIONAL ===== */
.payment-controls-card {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  z-index: 1000 !important;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 0 !important;
  padding: 6px;
  margin: 0 !important;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.payment-controls-card:hover {
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
}

/* Financial Summary Row */
.financial-summary {
  display: flex;
  gap: 2px;
  background: white;
  padding: 1px;
  border-radius: 6px;
  margin-bottom: 2px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.summary-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 2px 4px;
  border-radius: 4px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  min-width: 0;
}

.summary-field label {
  font-size: 0.65rem;
  margin-bottom: 0;
  font-weight: 600;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.summary-field .field-value {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1976d2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* Readonly field styling */
.readonly-field {
  background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
  cursor: default;
}

.readonly-field:hover {
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
  border-color: #bdbdbd;
}

/* Editable field styling */
.editable-field {
  background: white;
  border: 1px solid #1976d2;
}

.editable-field:hover {
  background: #e3f2fd;
  border-color: #1565c0;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.editable-field .field-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 700;
  color: #1976d2;
  padding: 0;
  text-align: left;
}

.editable-field .field-input:focus {
  color: #0d47a1;
}

/* Color-coded fields */
.warning-field .field-value {
  color: #f57c00;
}

.info-field .field-value {
  color: #0288d1;
}

.success-field {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border: 1px solid #4caf50;
}

.success-field .field-value {
  color: #2e7d32;
  font-size: 0.85rem;
}

.success-field:hover {
  background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
  box-shadow: 0 2px 6px rgba(76, 175, 80, 0.2);
}

/* Grand Total emphasis */
.grand-total {
  flex: 1.2;
}

.grand-total .field-value {
  font-size: 0.9rem;
  font-weight: 800;
}

/* Action Buttons Row */
.action-buttons {
  display: flex;
  gap: 1px;
  background: white;
  padding: 2px;
  border-radius: 6px;
  width: 100%;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  border: none;
  border-radius: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  min-width: 0;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}

.action-btn:active:not(:disabled) {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(50%);
}

.action-btn span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Button color variants */
.primary-btn {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
}

.success-btn {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
}

.success-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
}

.secondary-btn {
  background: linear-gradient(135deg, #757575 0%, #616161 100%);
  color: white;
}

.secondary-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #616161 0%, #424242 100%);
}

.purple-btn {
  background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
  color: white;
}

.purple-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%);
}

.error-btn {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  color: white;
}

.error-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
}

.action-icon {
  font-size: 16px;
}

/* Responsive adjustments */
@media (max-width: 1280px) {
  .summary-field label {
    font-size: 0.6rem;
  }

  .summary-field .field-value,
  .editable-field .field-input {
    font-size: 0.7rem;
  }

  .action-btn {
    height: 28px;
    font-size: 0.7rem;
  }

  .action-icon {
    font-size: 14px;
  }
}

/* ===== CUSTOM CHECKBOX ===== */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.custom-checkbox {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #1976d2;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  position: relative;
  background: white;
  transition: all 0.2s ease;
}

.custom-checkbox:checked {
  background: #1976d2;
  border-color: #1976d2;
}

.custom-checkbox:checked::after {
  content: "✓";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.custom-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background: #f5f5f5;
}

.custom-checkbox:disabled:checked {
  background: #9e9e9e;
  border-color: #9e9e9e;
}

.custom-checkbox:not(:disabled):hover {
  border-color: #1565c0;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

/* ===== INVOICE TABLE STYLES ===== */
.invoice-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  font-size: 0.75rem;
}

.table-header-cell {
  background: linear-gradient(180deg, rgba(128, 166, 255, 1) 0%, rgba(128, 166, 255, 0.25) 50%);
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 6px;
  font-weight: 600;
  font-size: 0.7rem;
  color: #424242;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table-row {
  border-bottom: 1px solid #f1f1f1;
  transition: background-color 0.15s;
}

.table-row:hover {
  background: #fafafa;
}

.table-cell {
  padding: 6px;
  vertical-align: middle;
  border-right: 1px solid #f5f5f5;
}

.table-cell:last-child {
  border-right: none;
}

/* Compact table for POS */
.invoice-items-scrollable {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.elevation-0 {
  box-shadow: none;
}
</style>
