<template>
  <div class="items-selector-container">
    <!-- Compact header with filters and counters -->
    <div class="selector-header">
      <div class="header-item">
        <div class="group-select-wrapper">
          <i class="mdi mdi-shape group-icon"></i>
          <select
            v-model="item_group"
            @change="onItemGroupChange"
            class="custom-group-select"
          >
            <option v-for="group in items_group" :key="group" :value="group">
              {{ group }}
            </option>
          </select>
        </div>
      </div>
      <div class="header-item">
        <button class="header-btn coupon-btn" @click="show_coupons">
          <i class="mdi mdi-ticket-percent header-icon"></i>
          <span>{{ couponsCount }} Coupons</span>
        </button>
      </div>
      <div class="header-item">
        <button class="header-btn offer-btn" @click="show_offers">
          <i class="mdi mdi-tag-multiple header-icon"></i>
          <span>{{ offersCount }} Offers</span>
        </button>
      </div>
    </div>

    <div class="selector-body">
      <div v-if="loading" class="custom-progress-linear">
        <div class="progress-bar"></div>
      </div>

      <!-- Search fields -->
      <div class="search-row">
        <div class="search-col">
          <div class="search-field-wrapper barcode-field">
            <div class="search-icon">
              <i class="mdi mdi-barcode barcode-icon"></i>
            </div>
            <input
              type="text"
              class="custom-search-input barcode-input"
              placeholder="Scan Barcode"
              v-model="barcode_search"
              @keyup.enter="handle_barcode_input"
              ref="barcode_search"
            />
            <button
              v-if="barcode_search"
              class="clear-btn"
              @click="barcode_search = ''"
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div class="search-col">
          <div class="search-field-wrapper name-field">
            <div v-if="search_loading" class="custom-progress-linear search-progress">
              <div class="progress-bar"></div>
            </div>
            <div class="search-icon">
              <i class="mdi mdi-magnify search-icon-element"></i>
            </div>
            <input
              type="text"
              class="custom-search-input name-input"
              placeholder="Search Item"
              v-model="debounce_search"
              @keydown.esc="esc_event"
              ref="debounce_search"
              autofocus
            />
            <button
              v-if="debounce_search"
              class="clear-btn"
              @click="debounce_search = ''"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- Items display area with virtual scrolling -->
      <div class="items-display-area">
        <!-- Card View with Virtual Scrolling -->
        <div class="items-content" v-if="items_view == 'card'">
          <VirtualScroll
            :items="filtred_items"
            :item-height="120"
            :container-height="containerHeight"
            :overscan="3"
            @container-height-changed="updateContainerHeight"
          >
            <template #default="{ item, index }">
              <div class="item-grid-col">
                <div @click="add_item(item)" class="item-card">
                  <div class="item-image-wrapper">
                    <img
                      :src="
                        item.image ||
                        '/assets/posawesome/js/posapp/components/pos/placeholder-image.png'
                      "
                      class="item-image"
                    />
                    <div
                      v-if="item.actual_qty !== undefined"
                      class="stock-indicator"
                    >
                      <span
                        :style="{
                          color: item.actual_qty > 0 ? '#4CAF50' : '#F44336',
                          fontWeight: 'bold',
                        }"
                      >
                        Qty: {{ formatFloat(item.actual_qty) }}
                      </span>
                    </div>
                  </div>

                  <div class="item-card-text text-center">
                    <div
                      class="text-caption"
                      style="font-weight: bold; margin-bottom: 4px"
                    >
                      {{ item.item_name }}
                    </div>

                    <div class="text-caption d-flex justify-space-between">
                      <span class="golden--text">
                        {{ item.stock_uom || "" }}
                      </span>
                      <span class="primary--text" style="font-weight: bold">
                        {{ currencySymbol(item.currency) || ""
                        }}{{ formatCurrency(item.rate) || 0 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </VirtualScroll>
        </div>

        <!-- List View with Virtual Scrolling -->
        <div class="items-content" v-if="items_view == 'list'">
          <div class="items-scrollable" :style="itemsScrollStyle">
            <table class="data-table">
              <thead>
                <tr class="table-header">
                  <th 
                    v-for="header in getItemsHeaders()" 
                    :key="header.value" 
                    class="table-header-cell" 
                    :style="{ textAlign: header.align || 'left' }"
                  >
                    {{ header.title || header.text }}
                  </th>
                </tr>
              </thead>
            </table>
            
            <VirtualScroll
              :items="filtred_items"
              :item-height="48"
              :container-height="containerHeight - 40"
              :overscan="5"
              @container-height-changed="updateContainerHeight"
            >
              <template #default="{ item, index }">
                <div 
                  @click="add_item_table(item)"
                  class="table-row virtual-table-row"
                >
                  <div 
                    v-for="header in getItemsHeaders()" 
                    :key="header.value" 
                    class="table-cell" 
                    :style="{ textAlign: header.align || 'left' }"
                  >
                    <span v-if="header.key === 'rate'" class="primary--text">
                      {{ formatCurrency(item.rate) }}
                    </span>
                    <span v-else-if="header.key === 'actual_qty'">
                      {{ formatFloat(item.actual_qty) }}
                    </span>
                    <span v-else>
                      {{ item[header.key] }}
                    </span>
                  </div>
                </div>
              </template>
            </VirtualScroll>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// ===== IMPORTS =====
import { evntBus } from "../../bus";
import format from "../../format";
import { API_MAP } from "../../api_mapper.js";
import VirtualScroll from './VirtualScroll.vue';

export default {
  name: 'ItemsSelector',
  components: {
    VirtualScroll
  },
  props: {
    items_view: {
      type: String,
      default: 'card'
    },
    items_group: {
      type: Array,
      default: () => []
    },
    filtred_items: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    search_loading: {
      type: Boolean,
      default: false
    },
    couponsCount: {
      type: Number,
      default: 0
    },
    offersCount: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      item_group: '',
      barcode_search: '',
      debounce_search: '',
      containerHeight: 400
    }
  },
  computed: {
    itemsScrollStyle() {
      return {
        height: this.containerHeight + 'px',
        overflow: 'hidden'
      }
    }
  },
  mounted() {
    this.updateContainerHeight()
    window.addEventListener('resize', this.updateContainerHeight)
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.updateContainerHeight)
  },
  
  methods: {
    updateContainerHeight() {
      // Calculate available height for items display
      const headerHeight = 120 // Approximate header height
      const searchHeight = 80 // Approximate search height
      const availableHeight = window.innerHeight - headerHeight - searchHeight - 100
      this.containerHeight = Math.max(300, availableHeight)
    },
    
    onItemGroupChange() {
      this.$emit('item-group-change', this.item_group)
    },
    
    show_coupons() {
      this.$emit('show-coupons')
    },
    
    show_offers() {
      this.$emit('show-offers')
    },
    
    handle_barcode_input() {
      this.$emit('barcode-input', this.barcode_search)
    },
    
    esc_event() {
      this.debounce_search = ''
      this.$emit('search-clear')
    },
    
    add_item(item) {
      this.$emit('add-item', item)
    },
    
    add_item_table(item) {
      this.$emit('add-item-table', item)
    },
    
    getItemsHeaders() {
      return [
        { key: 'item_name', title: 'Item Name', align: 'left' },
        { key: 'stock_uom', title: 'UOM', align: 'center' },
        { key: 'rate', title: 'Rate', align: 'right' },
        { key: 'actual_qty', title: 'Stock', align: 'right' }
      ]
    },
    
    formatCurrency(value) {
      return format.formatCurrency(value)
    },
    
    formatFloat(value) {
      return format.formatFloat(value)
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
.items-selector-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.header-item {
  display: flex;
  align-items: center;
}

.group-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-icon {
  font-size: 16px;
  color: #666;
}

.custom-group-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 14px;
}

.header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.coupon-btn {
  background: #ff9800;
  color: white;
}

.coupon-btn:hover {
  background: #f57c00;
}

.offer-btn {
  background: #4caf50;
  color: white;
}

.offer-btn:hover {
  background: #45a049;
}

.header-icon {
  font-size: 14px;
}

.selector-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-row {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.search-col {
  flex: 1;
}

.search-field-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  z-index: 1;
  color: #666;
}

.custom-search-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.custom-search-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.clear-btn {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  border: none;
  background: #ccc;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.items-display-area {
  flex: 1;
  overflow: hidden;
}

.items-content {
  height: 100%;
}

.items-scrollable {
  height: 100%;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.table-header {
  background: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table-header-cell {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 12px;
  color: #424242;
  border-bottom: 1px solid #e0e0e0;
}

.virtual-table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.virtual-table-row:hover {
  background: #fafafa;
}

.virtual-table-row .table-cell {
  flex: 1;
  padding: 12px 16px;
  font-size: 12px;
}

.item-grid-col {
  width: 100%;
  padding: 8px;
}

.item-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.item-card:hover {
  border-color: #1976d2;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.item-image-wrapper {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.stock-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  background: white;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 10px;
  border: 1px solid #e0e0e0;
}

.item-card-text {
  margin-top: 8px;
}

.text-caption {
  font-size: 11px;
  line-height: 1.2;
}

.custom-progress-linear {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #e0e0e0;
  z-index: 10;
}

.progress-bar {
  height: 100%;
  background: #1976d2;
  animation: progress 1s ease-in-out infinite;
}

@keyframes progress {
  0% { width: 0%; }
  50% { width: 70%; }
  100% { width: 100%; }
}
</style>
