<template>
  <div class="items-selector-container">
    <!-- Compact header with filters and counters -->
    <div class="selector-header">
      <div class="header-item">
        <div class="group-select-wrapper">
          <i class="mdi mdi-shape group-icon"></i>
          <select v-model="item_group" @change="onItemGroupChange" class="custom-group-select">
            <option v-for="group in items_group" :key="group" :value="group">
              {{ group }}
            </option>
          </select>
        </div>
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
            <input type="text" class="custom-search-input barcode-input" :placeholder="__('Scan Barcode')"
              v-model="barcode_search" @keyup.enter="handle_barcode_input" ref="barcode_search" />
            <button v-if="barcode_search" class="clear-btn" @click="barcode_search = ''" type="button">
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
            <input type="text" class="custom-search-input name-input" placeholder="Search Item"
              v-model="debounce_search" @keydown.esc="esc_event" ref="debounce_search" autofocus />
            <button v-if="debounce_search" class="clear-btn" @click="debounce_search = ''" type="button">
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- Items display area -->
      <div class="items-display-area">
        <div class="items-content" v-if="items_view == 'card'">
          <div class="items-grid" ref="itemsScrollArea" :style="itemsScrollStyle">
            <div v-for="(item, idx) in filtred_items" :key="idx" class="item-grid-col">
              <div @click="add_item(item)" class="item-card">
                <div class="item-image-wrapper">
                  <img :src="item.image ||
                    '/assets/posawesome/js/posapp/components/pos/placeholder-image.png'
                    " class="item-image" />
                  <div v-if="item.actual_qty !== undefined" class="stock-indicator">
                    <span :style="{
                      color: item.actual_qty > 0 ? '#4CAF50' : '#F44336',
                      fontWeight: 'bold',
                    }">
                      Qty: {{ formatFloat(item.actual_qty) }}
                    </span>
                  </div>
                </div>

                <div class="item-card-text text-center">
                  <div class="text-caption" style="font-weight: bold; margin-bottom: 4px">
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
          </div>
        </div>
        <div class="items-content" v-if="items_view == 'list'">
          <div class="items-scrollable" ref="itemsScrollArea" :style="itemsScrollStyle">
            <table class="data-table">
              <thead>
                <tr class="table-header">
                  <th v-for="header in getItemsHeaders()" :key="header.value" class="table-header-cell"
                    :style="{ textAlign: header.align || 'left' }">
                    {{ header.title || header.text }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filtred_items" :key="item.item_code" @click="add_item_table(item)" class="table-row">
                  <td v-for="header in getItemsHeaders()" :key="header.value" class="table-cell"
                    :style="{ textAlign: header.align || 'left' }">
                    <span v-if="header.key === 'rate'" class="primary--text">
                      {{ formatCurrency(item.rate) }}
                    </span>
                    <span v-else-if="header.key === 'actual_qty'">
                      {{ formatFloat(item.actual_qty) }}
                    </span>
                    <span v-else>
                      {{ item[header.key] }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./ItemsSelector.js" />

<style scoped>
/* ===== MAIN CONTAINER ===== */
.items-selector-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  overflow: hidden;
}

/* ===== COMPACT HEADER ===== */
.selector-header {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #e0e0e0;
}

.header-item {
  flex: 1;
  min-width: 0;
}

/* Group Select Wrapper */
.group-select-wrapper {
  width: 100%;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  position: relative;
}

.group-select-wrapper:hover {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #1976d2;
  box-shadow: 0 2px 6px rgba(25, 118, 210, 0.15);
}

.group-icon {
  color: #1976d2;
  flex-shrink: 0;
  font-size: 14px;
}

.custom-group-select {
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  font-size: 0.7rem;
  font-weight: 600;
  color: #1976d2;
  cursor: pointer;
  outline: none;
  padding-right: 16px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.custom-group-select:focus {
  outline: none;
}

/* Custom dropdown arrow */
.group-select-wrapper::after {
  content: "▼";
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  color: #1976d2;
  pointer-events: none;
}

.header-btn {
  width: 100%;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: none;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  background: white;
  border: 1px solid #e0e0e0;
  color: #1976d2;
}

.header-btn:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.header-btn span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.offer-btn:hover {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  border-color: #388e3c;
}

.header-icon {
  font-size: 14px;
}

/* ===== SELECTOR BODY ===== */
.selector-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ===== SEARCH ROW ===== */
.search-row {
  display: flex;
  gap: 3px;
  padding: 4px;
  background: #fafafa;
  border-bottom: 1px solid #e0e0e0;
}

.search-col {
  flex: 1;
  min-width: 0;
}

/* ===== CUSTOM SEARCH FIELDS ===== */
.search-field-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  height: 28px;
  overflow: hidden;
}

.search-field-wrapper:hover {
  border-color: #bdbdbd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.search-field-wrapper:focus-within {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.barcode-field:focus-within {
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.search-icon {
  display: flex;
  align-items: center;
  padding: 0 6px;
  height: 100%;
}

.barcode-icon {
  color: #4caf50;
  font-size: 16px;
}

.search-icon-element {
  color: #1976d2;
  font-size: 16px;
}

.custom-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 4px 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #333;
  height: 100%;
}

.custom-search-input::placeholder {
  color: #999;
  font-weight: 400;
  font-size: 0.75rem;
}

.custom-search-input:focus::placeholder {
  color: #bdbdbd;
}

.barcode-input {
  color: #2e7d32;
  font-weight: 600;
}

.name-input {
  color: #1565c0;
  font-weight: 500;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  margin-right: 2px;
  border-radius: 50%;
  padding: 0;
  line-height: 1;
}

.clear-btn:hover {
  background: #f5f5f5;
  color: #666;
}

.clear-btn:active {
  transform: scale(0.9);
}

/* ===== ITEMS DISPLAY AREA ===== */
/* Items Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
}

.item-grid-col {
  display: flex;
  flex-direction: column;
}

@media (max-width: 600px) {
  .items-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 601px) and (max-width: 960px) {
  .items-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 961px) and (max-width: 1264px) {
  .items-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1265px) and (max-width: 1904px) {
  .items-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

@media (min-width: 1905px) {
  .items-grid {
    grid-template-columns: repeat(8, 1fr);
  }
}

.items-display-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.items-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.items-scrollable {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
}

/* Special styling for table view - no padding, full height */
.items-content:has(.data-table) .items-scrollable {
  padding: 0;
  display: block;
}

/* Ensure table takes full width and height */
.items-scrollable .data-table {
  width: 100%;
  table-layout: fixed;
}

/* Column width distribution */
.data-table th:nth-child(1),
.data-table td:nth-child(1) {
  width: 30%;
}

.data-table th:nth-child(2),
.data-table td:nth-child(2) {
  width: 25%;
}

.data-table th:nth-child(3),
.data-table td:nth-child(3) {
  width: 10%;
}

.data-table th:nth-child(4),
.data-table td:nth-child(4) {
  width: 25%;
}

.data-table th:nth-child(5),
.data-table td:nth-child(5) {
  width: 10%;
}

/* ===== ITEM CARD STYLES ===== */
.item-card {
  height: 100%;
  min-height: 110px !important;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 6px !important;
}

.item-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.item-card .item-card__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 50px !important;
  padding: 4px !important;
}

.item-card .item-image {
  position: relative;
  height: 60px !important;
}

.item-card .item-image .item-card__text {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  margin: 3px;
  padding: 1px 4px !important;
  font-size: 0.65rem !important;
}

.item-image-wrapper {
  position: relative;
  height: 80px;
  overflow: hidden;
}

.stock-indicator {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 10px;
}

.item-card-text {
  padding: 8px;
}

.item-card .text-caption {
  font-size: 0.7rem !important;
  line-height: 1.2 !important;
}

/* ===== DATA TABLE STYLES ===== */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  background: white;
}

.table-header {
  border-bottom: 1px solid #e0e0e0;
}

.table-header-cell {
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #424242;
  background: linear-gradient(180deg, rgba(255, 174, 0, 1) 0%, rgba(255, 174, 0, 0.33) 50%);
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table-row {
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.table-row:hover {
  background: #e3f2fd;
}

.table-cell {
  padding: 8px 12px;
  font-size: 0.75rem;
  color: #424242;
  vertical-align: middle;
}

.primary--text {
  color: #1976d2;
  font-weight: 600;
}

/* ===== SCROLLBAR STYLING ===== */
.items-scrollable::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.items-scrollable::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.items-scrollable::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 3px;
}

.items-scrollable::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
}

/* ===== RESPONSIVE ADJUSTMENTS ===== */
@media (max-width: 1280px) {
  .item-card {
    min-height: 100px !important;
  }

  .item-card .item-image {
    height: 55px !important;
  }

  .header-btn {
    font-size: 0.65rem;
  }
}

@media (max-width: 1024px) {
  .selector-header {
    padding: 3px;
    gap: 3px;
  }

  .search-row {
    padding: 3px;
    gap: 2px;
  }

  .item-card {
    min-height: 90px !important;
  }

  .item-card .item-image {
    height: 50px !important;
  }

  .header-btn {
    height: 24px;
    font-size: 0.6rem;
  }

  .search-field-wrapper {
    height: 26px;
  }
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
</style>
