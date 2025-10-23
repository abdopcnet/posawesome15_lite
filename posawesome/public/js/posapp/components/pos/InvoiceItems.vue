<template>
  <div class="invoice-items-container">
    <div class="invoice-items-scrollable">
      <table class="invoice-table elevation-0" style="width: 600px">
        <thead>
          <tr>
            <th
              v-for="header in dynamicHeaders"
              :key="header.key"
              :style="{ width: header.width, textAlign: header.align }"
              class="table-header-cell"
            >
              {{ header.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.posa_row_id"
            class="table-row"
          >
            <!-- Item Name Column -->
            <td v-if="dynamicHeaders.find(h => h.key === 'item_name')" class="table-cell">
              <div style="width: 120px">
                <p class="mb-0">{{ item.item_name }}</p>
              </div>
            </td>

            <!-- Quantity Column -->
            <td v-if="dynamicHeaders.find(h => h.key === 'qty')" class="table-cell">
              <div class="compact-qty-controls">
                <button
                  class="qty-btn minus-btn"
                  @click="$emit('decrease-quantity', item)"
                  :disabled="!(item.qty && item.qty > 0)"
                  type="button"
                >
                  <span class="btn-icon">−</span>
                </button>
                <input
                  type="number"
                  v-model.number="item.qty"
                  @input="$emit('qty-input', item)"
                  @change="$emit('qty-change', item)"
                  @blur="$emit('qty-change', item)"
                  class="compact-qty-input"
                  placeholder="0"
                />
                <button
                  class="qty-btn plus-btn"
                  @click="$emit('increase-quantity', item)"
                  type="button"
                >
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
                <input
                  type="text"
                  :value="formatCurrency(item.rate)"
                  @change="$emit('set-item-rate', item, $event)"
                  @blur="$emit('set-item-rate', item, $event)"
                  @keyup.enter="$emit('set-item-rate', item, $event)"
                  :disabled="
                    Boolean(
                      item.posa_is_offer ||
                        item.posa_is_replace ||
                        item.posa_offer_applied ||
                        invoice_doc?.is_return
                    )
                  "
                  class="compact-rate-input"
                  placeholder="0.00"
                />
              </div>
            </td>

            <!-- Amount Column -->
            <td v-if="dynamicHeaders.find(h => h.key === 'amount')" class="table-cell">
              <div class="compact-amount-display">
                <span class="amount-value">
                  {{ formatCurrency(item.amount) }}
                </span>
              </div>
            </td>

            <!-- Actions Column -->
            <td v-if="dynamicHeaders.find(h => h.key === 'actions')" class="table-cell">
              <div class="compact-actions">
                <button
                  class="action-btn remove-btn"
                  @click="$emit('remove-item', item)"
                  title="Remove Item"
                >
                  <i class="mdi mdi-delete action-icon"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InvoiceItems',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    dynamicHeaders: {
      type: Array,
      default: () => []
    },
    invoice_doc: {
      type: Object,
      default: null
    }
  },
  emits: [
    'decrease-quantity',
    'increase-quantity', 
    'qty-input',
    'qty-change',
    'set-item-rate',
    'remove-item'
  ],
  methods: {
    formatCurrency(value) {
      if (!value) return '0.00'
      return parseFloat(value).toFixed(2)
    }
  }
}
</script>

<style scoped>
.invoice-items-container {
  flex: 1;
  overflow: hidden;
}

.invoice-items-scrollable {
  height: 100%;
  overflow-y: auto;
}

.invoice-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.table-header-cell {
  background: #f5f5f5;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 12px;
  color: #424242;
  border-bottom: 1px solid #e0e0e0;
  text-align: left;
}

.table-row {
  border-bottom: 1px solid #f0f0f0;
}

.table-row:hover {
  background: #fafafa;
}

.table-cell {
  padding: 8px 12px;
  font-size: 12px;
  vertical-align: middle;
}

.compact-qty-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.qty-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.qty-btn:hover {
  background: #f5f5f5;
}

.qty-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.compact-qty-input {
  width: 50px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 3px;
  text-align: center;
  font-size: 12px;
  padding: 0 4px;
}

.compact-price-display,
.compact-amount-display {
  text-align: right;
}

.amount-value {
  font-weight: 500;
  color: #424242;
}

.compact-rate-wrapper {
  display: flex;
  align-items: center;
}

.compact-rate-input {
  width: 80px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 3px;
  text-align: right;
  font-size: 12px;
  padding: 0 6px;
}

.compact-rate-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.compact-actions {
  display: flex;
  justify-content: center;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}

.remove-btn {
  background: #f44336;
  color: white;
}

.remove-btn:hover {
  background: #d32f2f;
}

.action-icon {
  font-size: 14px;
}
</style>
