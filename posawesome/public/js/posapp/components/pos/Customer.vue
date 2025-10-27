<template>
  <div class="customer-component">
    <div class="autocomplete" :style="{ backgroundColor: quick_return ? '#fff1f0' : 'white' }">
      <div class="autocomplete-input-wrapper">
        <input type="text" class="autocomplete-input" :placeholder="'Search customer...'" v-model="customer_search"
          :disabled="readonly" @focus="handleCustomerFocus" @input="performSearch" @keydown.enter="handleEnter"
          @keydown.down="navigateDown" @keydown.up="navigateUp" @keydown.esc="showDropdown = false"
          aria-autocomplete="list" aria-expanded="showDropdown" role="combobox" />

        <div class="autocomplete-icons" aria-hidden="true">
          <button class="autocomplete-icon-btn" @click="edit_customer" :disabled="readonly" title="Edit Customer"
            type="button">
            <i class="mdi mdi-account-edit"></i>
          </button>
          <button class="autocomplete-icon-btn" @click="new_customer" :disabled="readonly" title="New Customer"
            type="button">
            <i class="mdi mdi-plus"></i>
          </button>
        </div>
      </div>

      <!-- Dropdown -->
      <div v-if="showDropdown && filteredCustomers.length > 0" class="autocomplete-dropdown" role="listbox">
        <div v-for="(item, index) in filteredCustomers" :key="item.name" class="autocomplete-item"
          :class="{ 'autocomplete-item--active': index === selectedIndex }" role="option"
          :aria-selected="index === selectedIndex" @click="selectCustomer(item)" @mouseenter="selectedIndex = index">
          <div class="autocomplete-item-left" aria-hidden="true">
            <div class="avatar-placeholder">{{ (item.customer_name || '?').charAt(0).toUpperCase() }}</div>
          </div>

          <div class="autocomplete-item-body">
            <div class="autocomplete-item-title">{{ item.customer_name }}</div>
            <div v-if="item.mobile_no" class="autocomplete-item-subtitle">{{ item.mobile_no }}</div>
            <div v-else class="autocomplete-item-subtitle muted">No number</div>
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="showDropdown && loading" class="autocomplete-loading" role="status" aria-live="polite">
        <div class="progress-linear">
          <div class="progress-bar"></div>
        </div>
      </div>
    </div>

    <!-- UpdateCustomer wrapper: respects CSS variable set by UpdateCustomer.js -->

    <UpdateCustomer />
  </div>
</template>

<script src="./Customer.js" />

<style scoped>
.customer-component {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
}

/* wrapper */
.autocomplete {
  position: relative;
  width: 100%;
  --input-height: 44px;
}

/* input wrapper */
.autocomplete-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  padding: 6px 0;
}

/* input */
.autocomplete-input {
  width: 100%;
  padding: 13px 46px 13px 12px;
  height: var(--input-height);
  border: 1px solid rgba(60, 60, 67, 0.10);
  border-radius: 10px;
  font-size: 14px;
  background: #fff;
  transition: box-shadow 160ms ease, border-color 160ms ease;
  box-sizing: border-box;
}

/* focus */
.autocomplete-input:focus {
  outline: none;
  border-color: rgba(25, 118, 210, 0.9);
  box-shadow: 0 8px 24px rgba(25, 118, 210, 0.06);
}

/* disabled */
.autocomplete-input:disabled {
  background: #f6f7f8;
  color: #8e8e93;
  cursor: not-allowed;
}

/* icon area */
.autocomplete-icons {
  position: absolute;
  right: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
  height: 100%;
}

/* icon buttons */
.autocomplete-icon-btn {
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: #6b7280;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 120ms ease, color 120ms ease;
  height: 32px;
  width: 32px;
}

.autocomplete-icon-btn:hover:not(:disabled) {
  background: rgba(16, 24, 40, 0.04);
  color: rgba(25, 118, 210, 0.95);
}

.autocomplete-icon-btn:disabled {
  color: #c1c1c6;
  cursor: not-allowed;
}

/* dropdown */
.autocomplete-dropdown {
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
}

/* item */
.autocomplete-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  transition: background-color 120ms ease;
  border-radius: 8px;
}

/* hover / active */
.autocomplete-item:hover,
.autocomplete-item--active {
  background: rgba(16, 24, 40, 0.03);
}

/* avatar placeholder */
.autocomplete-item-left .avatar-placeholder {
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
}

/* body */
.autocomplete-item-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.autocomplete-item-title {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.autocomplete-item-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1;
}

/* muted fallback */
.muted {
  color: #9ca3af;
}

/* loading card */
.autocomplete-loading {
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
}

/* progress linear */
.progress-linear {
  width: 100%;
  height: 6px;
  background: #eef2f7;
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, rgba(25, 118, 210, 1), rgba(33, 150, 243, 1));
  border-radius: 6px;
  animation: progressIndeterminate 1.2s infinite linear;
}

@keyframes progressIndeterminate {
  0% {
    transform: translateX(-100%) scaleX(0.2);
  }

  60% {
    transform: translateX(20%) scaleX(0.6);
  }

  100% {
    transform: translateX(120%) scaleX(0.2);
  }
}

/* UpdateCustomer wrapper styling */
.update-customer-wrapper {
  box-sizing: border-box;
  margin-top: 12px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.04);
  background: #ffffff;
  overflow: hidden;
}

/* responsive tweaks */
@media (max-width: 600px) {
  .autocomplete-input {
    height: 48px;
    padding: 12px 46px 12px 12px;
  }

  .autocomplete-item-left .avatar-placeholder {
    width: 36px;
    height: 36px;
  }
}
</style>
