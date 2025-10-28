<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- ITEMS SELECTOR COMPONENT -->
  <!-- =========================================== -->
  <div
    style="display: flex; flex-direction: column; height: 100%; background: white; overflow: hidden"
  >
    <!-- =========================================== -->
    <!-- COMPACT HEADER WITH FILTERS AND COUNTERS -->
    <!-- =========================================== -->
    <div
      style="
        display: flex;
        gap: 4px;
        padding: 4px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-bottom: 1px solid #e0e0e0;
      "
    >
      <div style="flex: 1; min-width: 0">
        <div
          style="
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
          "
        >
          <i class="mdi mdi-shape" style="color: #1976d2; flex-shrink: 0; font-size: 14px"></i>
          <select
            v-model="item_group"
            @change="onItemGroupChange"
            style="
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
            "
          >
            <option v-for="group in items_group" :key="group" :value="group">
              {{ group }}
            </option>
          </select>
          <!-- Dropdown arrow -->
          <span
            style="
              content: '▼';
              position: absolute;
              right: 8px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 8px;
              color: #1976d2;
              pointer-events: none;
            "
            >▼</span
          >
        </div>
      </div>

      <div style="flex: 1; min-width: 0">
        <button
          @click="show_offers"
          style="
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
          "
        >
          <i class="mdi mdi-tag-multiple" style="font-size: 14px"></i>
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
            >{{ offersCount }} Offers</span
          >
        </button>
      </div>
    </div>

    <div
      style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative"
    >
      <!-- Loading Progress -->
      <div
        v-if="loading"
        style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: #e0e0e0;
          overflow: hidden;
          z-index: 10;
        "
      >
        <div
          style="
            height: 100%;
            background: #1976d2;
            animation: progress-indeterminate 1.5s infinite linear;
            transform-origin: 0% 50%;
          "
        ></div>
      </div>

      <!-- =========================================== -->
      <!-- SEARCH FIELDS -->
      <!-- =========================================== -->
      <div
        style="
          display: flex;
          gap: 3px;
          padding: 4px;
          background: #fafafa;
          border-bottom: 1px solid #e0e0e0;
        "
      >
        <!-- Barcode Search -->
        <div style="flex: 1; min-width: 0">
          <div
            style="
              position: relative;
              display: flex;
              align-items: center;
              background: white;
              border: 1px solid #e0e0e0;
              border-radius: 4px;
              height: 28px;
              overflow: hidden;
            "
          >
            <div style="display: flex; align-items: center; padding: 0 6px; height: 100%">
              <i class="mdi mdi-barcode" style="color: #4caf50; font-size: 16px"></i>
            </div>

            <input
              type="text"
              :placeholder="__('Scan Barcode')"
              v-model="barcode_search"
              @keyup.enter="handle_barcode_input"
              ref="barcode_search"
              style="
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                padding: 4px 6px;
                font-size: 0.8rem;
                font-weight: 500;
                color: #2e7d32;
                height: 100%;
                font-weight: 600;
              "
            />

            <button
              v-if="barcode_search"
              @click="barcode_search = ''"
              type="button"
              style="
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
              "
            >
              ×
            </button>
          </div>
        </div>

        <!-- Name Search -->
        <div style="flex: 1; min-width: 0">
          <div
            style="
              position: relative;
              display: flex;
              align-items: center;
              background: white;
              border: 1px solid #e0e0e0;
              border-radius: 4px;
              height: 28px;
              overflow: hidden;
            "
          >
            <div
              v-if="search_loading"
              style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: #e0e0e0;
                overflow: hidden;
                z-index: 10;
              "
            >
              <div
                style="
                  height: 100%;
                  background: #1976d2;
                  animation: progress-indeterminate 1.5s infinite linear;
                  transform-origin: 0% 50%;
                "
              ></div>
            </div>

            <div style="display: flex; align-items: center; padding: 0 6px; height: 100%">
              <i class="mdi mdi-magnify" style="color: #1976d2; font-size: 16px"></i>
            </div>

            <input
              type="text"
              :placeholder="__('Search Item')"
              v-model="debounce_search"
              @keydown.esc="esc_event"
              ref="debounce_search"
              autofocus
              style="
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                padding: 4px 6px;
                font-size: 0.8rem;
                font-weight: 500;
                color: #1565c0;
                height: 100%;
              "
            />

            <button
              v-if="debounce_search"
              @click="debounce_search = ''"
              type="button"
              style="
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
              "
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- =========================================== -->
      <!-- ITEMS DISPLAY AREA -->
      <!-- =========================================== -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0">
        <!-- Card View -->
        <div
          v-if="items_view == 'card'"
          style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0"
        >
          <div
            ref="itemsScrollArea"
            :style="itemsScrollStyle"
            style="
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
              gap: 8px;
              padding: 8px;
              overflow-y: auto;
            "
          >
            <div
              v-for="(item, idx) in filtred_items"
              :key="idx"
              style="display: flex; flex-direction: column"
            >
              <div
                @click="add_item(item)"
                style="
                  height: 100%;
                  min-height: 110px;
                  display: flex;
                  flex-direction: column;
                  cursor: pointer;
                  border-radius: 6px;
                "
              >
                <div style="position: relative; height: 80px; overflow: hidden">
                  <img
                    :src="
                      item.image ||
                      '/assets/posawesome/js/posapp/components/pos/placeholder-image.png'
                    "
                    style="width: 100%; height: 100%; object-fit: cover"
                  />
                  <div
                    v-if="item.actual_qty !== undefined"
                    style="
                      position: absolute;
                      bottom: 4px;
                      right: 4px;
                      background: rgba(0, 0, 0, 0.7);
                      color: white;
                      padding: 2px 4px;
                      border-radius: 4px;
                      font-size: 10px;
                    "
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

                <div style="padding: 8px; text-align: center">
                  <div
                    style="
                      font-size: 0.7rem;
                      line-height: 1.2;
                      font-weight: bold;
                      margin-bottom: 4px;
                    "
                  >
                    {{ item.item_name }}
                  </div>

                  <div
                    style="
                      font-size: 0.7rem;
                      line-height: 1.2;
                      display: flex;
                      justify-content: space-between;
                    "
                  >
                    <span>{{ item.stock_uom || '' }}</span>
                    <span style="color: #1976d2; font-weight: bold">
                      {{ currencySymbol(item.currency) || '' }}{{ formatCurrency(item.rate) || 0 }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div
          v-if="items_view == 'list'"
          style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0"
        >
          <div
            ref="itemsScrollArea"
            :style="itemsScrollStyle"
            style="
              flex: 1;
              min-height: 0;
              overflow-y: auto;
              overflow-x: hidden;
              padding: 0;
              display: block;
            "
          >
            <table
              style="
                width: 100%;
                border-collapse: collapse;
                font-size: 0.75rem;
                background: white;
                table-layout: fixed;
              "
            >
              <thead>
                <tr style="border-bottom: 1px solid #e0e0e0">
                  <th
                    v-for="header in getItemsHeaders()"
                    :key="header.value"
                    :style="{ textAlign: header.align || 'left' }"
                    style="
                      padding: 8px 12px;
                      font-size: 0.75rem;
                      font-weight: 600;
                      color: #424242;
                      background: linear-gradient(
                        180deg,
                        rgba(255, 174, 0, 1) 0%,
                        rgba(255, 174, 0, 0.33) 50%
                      );
                      border-bottom: 1px solid #e0e0e0;
                      position: sticky;
                      top: 0;
                      z-index: 1;
                    "
                  >
                    {{ header.title || header.text }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in filtred_items"
                  :key="item.item_code"
                  @click="add_item_table(item)"
                  style="
                    border-bottom: 1px solid #f0f0f0;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                  "
                >
                  <td
                    v-for="header in getItemsHeaders()"
                    :key="header.value"
                    :style="{ textAlign: header.align || 'left' }"
                    style="
                      padding: 8px 12px;
                      font-size: 0.75rem;
                      color: #424242;
                      vertical-align: middle;
                    "
                  >
                    <span v-if="header.key === 'rate'" style="color: #1976d2; font-weight: 600">
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
