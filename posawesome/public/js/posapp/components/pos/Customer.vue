<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- CUSTOMER COMPONENT -->
  <!-- =========================================== -->
  <div
    style="
      font-family:
        system-ui,
        -apple-system,
        'Segoe UI',
        Roboto,
        'Helvetica Neue',
        Arial;
    "
  >
    <!-- =========================================== -->
    <!-- AUT GüMplete Container -->
    <!-- =========================================== -->
    <div
      :style="{
        backgroundColor: quick_return ? '#fff1f0' : 'white',
      }"
      style="position: relative; width: 100%; --input-height: 44px"
    >
      <!-- =========================================== -->
      <!-- Input Wrapper -->
      <!-- =========================================== -->
      <div style="position: relative; display: flex; align-items: center; padding: 6px 0">
        <!-- Customer Search Input -->
        <input
          type="text"
          :placeholder="'Search customer...'"
          v-model="customer_search"
          :disabled="readonly"
          @focus="handleCustomerFocus"
          @input="performSearch"
          @keydown.enter="handleEnter"
          @keydown.down="navigateDown"
          @keydown.up="navigateUp"
          @keydown.esc="showDropdown = false"
          aria-autocomplete="list"
          aria-expanded="showDropdown"
          role="combobox"
          style="
            width: 100%;
            padding: 13px 46px 13px 12px;
            height: var(--input-height);
            border: 1px solid rgba(60, 60, 67, 0.1);
            border-radius: 10px;
            font-size: 14px;
            background: #fff;
            transition:
              box-shadow 160ms ease,
              border-color 160ms ease;
            box-sizing: border-box;
            outline: none;
          "
          :style="readonly ? 'background: #f6f7f8; color: #8e8e93; cursor: not-allowed' : ''"
        />

        <!-- Action Buttons (Edit & New) -->
        <div
          aria-hidden="true"
          style="
            position: absolute;
            right: 8px;
            display: flex;
            gap: 8px;
            align-items: center;
            height: 100%;
          "
        >
          <!-- Edit Customer Button -->
          <button
            @click="edit_customer"
            :disabled="readonly"
            title="Edit Customer"
            type="button"
            style="
              background: transparent;
              border: none;
              padding: 6px;
              cursor: pointer;
              color: #6b7280;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              transition:
                background-color 120ms ease,
                color 120ms ease;
              height: 32px;
              width: 32px;
            "
            :style="readonly ? 'color: #c1c1c6; cursor: not-allowed' : ''"
          >
            <i class="mdi mdi-account-edit"></i>
          </button>

          <!-- New Customer Button -->
          <button
            @click="new_customer"
            :disabled="readonly"
            title="New Customer"
            type="button"
            style="
              background: transparent;
              border: none;
              padding: 6px;
              cursor: pointer;
              color: #6b7280;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              transition:
                background-color 120ms ease,
                color 120ms ease;
              height: 32px;
              width: 32px;
            "
            :style="readonly ? 'color: #c1c1c6; cursor: not-allowed' : ''"
          >
            <i class="mdi mdi-plus"></i>
          </button>
        </div>
      </div>

      <!-- =========================================== -->
      <!-- Customer Dropdown -->
      <!-- =========================================== -->
      <div
        v-if="showDropdown && filteredCustomers.length > 0"
        role="listbox"
        style="
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid rgba(60, 60, 67, 0.08);
          border-radius: 12px;
          box-shadow: 0 16px 40px rgba(12, 24, 40, 0.08);
          z-index: 1200;
          max-height: 300px;
          overflow-y: auto;
          padding: 8px;
        "
      >
        <div
          v-for="(item, index) in filteredCustomers"
          :key="item.name"
          role="option"
          :aria-selected="index === selectedIndex"
          @click="selectCustomer(item)"
          @mouseenter="selectedIndex = index"
          style="
            display: flex;
            gap: 12px;
            align-items: center;
            padding: 10px;
            cursor: pointer;
            transition: background-color 120ms ease;
            border-radius: 8px;
          "
          :style="index === selectedIndex ? 'background: rgba(16, 24, 40, 0.03)' : ''"
        >
          <!-- Avatar Placeholder -->
          <div aria-hidden="true">
            <div
              style="
                width: 40px;
                height: 40px;
                border-radius: 8px;
                background: linear-gradient(135deg, #f3f4f6, #eef2ff);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #374151;
                font-weight: 700;
                font-size: 15px;
                flex-shrink: 0;
              "
            >
              {{ (item.customer_name || '?').charAt(0).toUpperCase() }}
            </div>
          </div>

          <!-- Customer Info -->
          <div style="display: flex; flex-direction: column; min-width: 0">
            <!-- Customer Name -->
            <div
              style="
                font-weight: 600;
                color: #0f172a;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              "
            >
              {{ item.customer_name }}
            </div>

            <!-- Mobile Number -->
            <div
              v-if="item.mobile_no"
              style="font-size: 12px; color: #6b7280; margin-top: 4px; line-height: 1"
            >
              {{ item.mobile_no }}
            </div>
            <div v-else style="font-size: 12px; color: #9ca3af; margin-top: 4px; line-height: 1">
              No number
            </div>
          </div>
        </div>
      </div>

      <!-- =========================================== -->
      <!-- Loading Indicator -->
      <!-- =========================================== -->
      <div
        v-if="showDropdown && loading"
        role="status"
        aria-live="polite"
        style="
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid rgba(60, 60, 67, 0.08);
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 12px 32px rgba(12, 24, 40, 0.06);
          z-index: 1200;
        "
      >
        <div
          style="
            width: 100%;
            height: 6px;
            background: #eef2f7;
            border-radius: 6px;
            overflow: hidden;
          "
        >
          <div
            style="
              height: 100%;
              background: linear-gradient(90deg, rgba(25, 118, 210, 1), rgba(33, 150, 243, 1));
              border-radius: 6px;
              animation: progressIndeterminate 1.2s infinite linear;
            "
          ></div>
        </div>
      </div>
    </div>

    <!-- =========================================== -->
    <!-- UpdateCustomer Wrapper -->
    <!-- =========================================== -->
    <UpdateCustomer />
  </div>
</template>

<script src="./Customer.js" />
