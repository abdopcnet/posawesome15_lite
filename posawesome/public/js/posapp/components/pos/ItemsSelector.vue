<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- ITEMS SELECTOR COMPONENT -->
  <!-- =========================================== -->
  <div
    style="
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      overflow: hidden;
    "
  >
    <!-- =========================================== -->
    <!-- COMPACT HEADER WITH FILTERS AND COUNTERS -->
    <!-- =========================================== -->
    <div
      style="
        display: flex;
        gap: 4px;
        padding: 4px;
        background: #c4763d85;
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
          <i
            class="mdi mdi-shape"
            style="color: #1976d2; flex-shrink: 0; font-size: 18px"
          ></i>
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
              text-align: center;
            "
          >
            <option v-for="group in items_group" :key="group" :value="group">
              {{ group === "item_group_menu" ? "مجموعات الأصناف" : group }}
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
              font-size: 13px;
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
          <i class="mdi mdi-tag-multiple" style="font-size: 18px"></i>
          <span>{{ offersCount }} العروض</span>
        </button>
      </div>
    </div>

    <div
      style="
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      "
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
          background: #c4763d85;
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
            <div
              style="
                display: flex;
                align-items: center;
                padding: 0 6px;
                height: 100%;
              "
            >
              <i
                class="mdi mdi-barcode"
                style="color: #4caf50; font-size: 20px"
              ></i>
            </div>

            <!-- Barcode disabled in return mode or Scan Barcode -->
            <input
              type="text"
              :placeholder="
                is_return_invoice
                  ? 'الباركود معطل في وضع المرتجعات'
                  : 'مسح الباركود'
              "
              v-model="barcode_search"
              @keyup.enter="handle_barcode_input"
              ref="barcode_search"
              :disabled="is_return_invoice"
              autofocus
              :style="{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '4px 6px',
                fontSize: '0.8rem',
                color: is_return_invoice ? '#999' : '#0f172a',
                fontWeight: '700',
                height: '100%',
                cursor: is_return_invoice ? 'not-allowed' : 'text',
                textAlign: 'center',
              }"
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

            <div
              style="
                display: flex;
                align-items: center;
                padding: 0 6px;
                height: 100%;
              "
            >
              <i
                class="mdi mdi-magnify"
                style="color: #1976d2; font-size: 20px"
              ></i>
            </div>

            <!-- Search Item -->
            <input
              type="text"
              placeholder="بحث عن صنف"
              v-model="debounce_search"
              @keydown.esc="esc_event"
              ref="debounce_search"
              style="
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                padding: 4px 6px;
                font-size: 0.8rem;
                /* stronger, darker placeholder + text */
                color: #0f172a;
                font-weight: 700;
                height: 100%;
                text-align: center;
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
      <div
        style="
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        "
      >
        <!-- Card View -->
        <div
          v-if="items_view == 'card'"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
          "
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
              @click="add_item(item)"
              :title="
                is_return_invoice
                  ? 'Cannot add items in return mode'
                  : item.item_name
              "
              :style="{
                position: 'relative',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                cursor: is_return_invoice ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                transition: 'transform 0.2s ease',
                overflow: 'hidden',
                background: 'white',
                display: 'flex',
                flexDirection: 'column',
                height: '200px',
                minHeight: '200px',
                opacity: is_return_invoice ? 0.5 : 1,
                filter: is_return_invoice ? 'grayscale(50%)' : 'none',
              }"
              @mouseenter="
                !is_return_invoice &&
                  ($event.currentTarget.style.transform = 'scale(1.02)')
              "
              @mouseleave="
                !is_return_invoice &&
                  ($event.currentTarget.style.transform = 'scale(1)')
              "
            >
              <!-- Quantity Pill -->
              <div
                v-if="item.actual_qty !== undefined"
                style="
                  position: absolute;
                  top: 8px;
                  right: 8px;
                  z-index: 2;
                  display: flex;
                  align-items: center;
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  backdrop-filter: blur(4px);
                "
                :style="{
                  background:
                    item.actual_qty > 10
                      ? 'rgba(76, 175, 80, 0.9)'
                      : item.actual_qty <= 0
                      ? 'rgba(244, 67, 54, 0.9)'
                      : 'rgba(255, 152, 0, 0.9)',
                  color: 'white',
                }"
              >
                {{ formatFloat(item.actual_qty) }}
              </div>

              <!-- Image or Abbreviation -->
              <div
                v-if="item.image"
                style="
                  flex: 1;
                  min-height: 140px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e0e0e0;
                  overflow: hidden;
                "
              >
                <img
                  :src="item.image"
                  :alt="item.item_name"
                  @error="$event.target.style.display = 'none'"
                  style="width: 100%; height: 100%; object-fit: cover"
                />
              </div>
              <div
                v-else
                style="
                  flex: 1;
                  min-height: 140px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                  border-bottom: 1px solid #e0e0e0;
                  font-size: 2.5rem;
                  font-weight: 700;
                  color: #9e9e9e;
                "
              >
                {{ item.item_name.substring(0, 2).toUpperCase() }}
              </div>

              <!-- Item Details -->
              <div
                style="
                  padding: 8px;
                  background: white;
                  display: flex;
                  flex-direction: column;
                  gap: 2px;
                "
              >
                <div
                  style="
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 4px;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                  "
                >
                  {{ item.item_name }}
                </div>
                <div
                  style="font-size: 0.85rem; font-weight: 700; color: #1976d2"
                >
                  {{ formatCurrency(item.rate) }} / {{ item.stock_uom }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div
          v-if="items_view == 'list'"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
          "
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
                max-width: 100%;
                border-collapse: collapse;
                font-size: 0.75rem;
                background: white;
                table-layout: auto; /* let browser size columns by content */
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
                      white-space: nowrap; /* no wrapping */
                      overflow: hidden; /* clip overflow */
                      text-overflow: ellipsis; /* show ellipsis when truncated */
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
                  :title="
                    is_return_invoice
                      ? 'Cannot add items in return mode'
                      : item.item_name
                  "
                  @mouseenter="
                    !is_return_invoice &&
                      ($event.currentTarget.style.background =
                        'rgba(16,24,40,0.09)');
                    $event.currentTarget.style.transition =
                      'background-color 160ms ease';
                  "
                  @mouseleave="
                    $event.currentTarget.style.background = '';
                    $event.currentTarget.style.transition =
                      'background-color 160ms ease';
                  "
                  :style="{
                    borderBottom: '1px solid #f0f0f0',
                    cursor: is_return_invoice ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s ease',
                    opacity: is_return_invoice ? 0.5 : 1,
                  }"
                >
                  <td
                    v-for="header in getItemsHeaders()"
                    :key="header.value"
                    :style="{ textAlign: header.align || 'left' }"
                    style="
                      padding: 13px 12px;
                      font-size: 0.75rem;
                      color: #424242;
                      vertical-align: middle;
                      white-space: nowrap; /* no wrapping */
                      overflow: hidden; /* clip overflow */
                      text-overflow: ellipsis; /* ellipsis when truncated */
                      min-width: 0; /* allow cell to shrink within table */
                    "
                  >
                    <span
                      v-if="header.key === 'rate'"
                      style="
                        color: #1976d2;
                        font-weight: 600;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      "
                    >
                      {{ formatCurrency(item.rate) }}
                    </span>
                    <span
                      v-else-if="header.key === 'actual_qty'"
                      style="
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      "
                    >
                      {{ formatFloat(item.actual_qty) }}
                    </span>
                    <span
                      v-else
                      style="
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      "
                    >
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
