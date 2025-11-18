<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- CUSTOMER COMPONENT -->
  <!-- =========================================== -->
  <div
    style="
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue,
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
      style="position: relative; width: 100%; --input-height: 51px"
    >
      <!-- =========================================== -->
      <!-- Input Wrapper -->
      <!-- =========================================== -->
      <div
        style="
          position: relative;
          display: flex;
          align-items: center;
          padding: 6px 0;
        "
      >
        <!-- Customer Search Input -->
        <input
          type="text"
          :placeholder="'ابحث عن عميل...'"
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
            transition: box-shadow 160ms ease, border-color 160ms ease;
            box-sizing: border-box;
            outline: none;
          "
          :style="
            readonly
              ? 'background: #f6f7f8; color: #8e8e93; cursor: not-allowed'
              : ''
          "
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
            @mouseenter="buttonHoverEnter"
            @mouseleave="buttonHoverLeave"
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
              transition: background-color 120ms ease, color 120ms ease,
                box-shadow 120ms ease;
              height: 32px;
              width: 32px;
              font-size: 25px;
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
            @mouseenter="buttonHoverEnter"
            @mouseleave="buttonHoverLeave"
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
              transition: background-color 120ms ease, color 120ms ease,
                box-shadow 120ms ease;
              height: 32px;
              width: 32px;
              font-size: 25px;
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
          top: calc(100% + 9px);
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
          class="customer-item"
          :data-index="index"
          :data-selected="index === selectedIndex"
          style="
            display: flex;
            gap: 12px;
            align-items: center;
            padding: 10px;
            cursor: pointer;
            transition: background-color 150ms ease;
            border-radius: 8px;
            background-color: var(--row-bg, rgba(255, 255, 255, 1));
          "
          :data-even="index % 2 === 0"
        >
          <!-- Avatar Placeholder -->
          <div aria-hidden="true">
            <!-- lightweight SVG faceless avatar with subtle gradient background (fast) -->
            <svg
              :width="40"
              :height="40"
              viewBox="0 0 40 40"
              style="
                flex-shrink: 0;
                display: block;
                border-radius: 8px;
                overflow: visible;
              "
              role="img"
              :aria-label="
                (item.customer_name || '?').charAt(0).toUpperCase() + ' avatar'
              "
            >
              <defs>
                <linearGradient
                  :id="`g${avatarHue(item.customer_name)}`"
                  x1="0"
                  x2="1"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0"
                    :stop-color="`hsl(${avatarHue(
                      item.customer_name
                    )} 72% 86%)`"
                  />
                  <stop
                    offset="1"
                    :stop-color="`hsl(${avatarHue(
                      item.customer_name
                    )} 66% 74%)`"
                  />
                </linearGradient>
              </defs>

              <!-- gradient background -->
              <rect
                x="0"
                y="0"
                width="40"
                height="40"
                :fill="`url(#g${avatarHue(item.customer_name)})`"
                rx="8"
                ry="8"
              />

              <!-- simple faceless silhouette (circle head + ellipse shoulders) -->
              <g fill="rgba(255,255,255,0.92)" transform="translate(0,0)">
                <circle cx="20" cy="13" r="6" />
                <ellipse cx="20" cy="28" rx="11" ry="5.2" />
              </g>
            </svg>
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
                font-weight: bold;
              "
            >
              {{ item.customer_name }}
            </div>

            <!-- Mobile Number -->
            <div
              v-if="item.mobile_no"
              style="
                font-size: 12px;
                color: #6b7280;
                margin-top: 4px;
                line-height: 1;
              "
            >
              {{ item.mobile_no }}
            </div>
            <div
              v-else
              style="
                font-size: 12px;
                color: #9ca3af;
                margin-top: 4px;
                line-height: 1;
              "
            >
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
              background: linear-gradient(
                90deg,
                rgba(25, 118, 210, 1),
                rgba(33, 150, 243, 1)
              );
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

<script>
import comp from "./Customer.js";
import { posawesome_logger } from "../../logger.js";

comp.methods = {
  ...comp.methods,

  avatarColor(name) {
    const s = (name || "").toString();
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 65% 78%)`;
  },

  // return the hue (0..359) used to build per-name gradients (cheap, deterministic)
  avatarHue(name) {
    const s = (name || "").toString();
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) % 360;
  },

  avatarTextColor() {
    return "#0f172a";
  },

  // Inline hover handlers for the two action buttons.
  // Fast: mutate a few inline properties only (background, color, boxShadow) and restore on leave.
  buttonHoverEnter(e) {
    try {
      const el = e.currentTarget;
      if (el.disabled) return;
      // store originals for restore
      el.dataset._origBg = el.style.background || "";
      el.dataset._origColor = el.style.color || "";
      el.dataset._origBox = el.style.boxShadow || "";
      // modern visible hover
      el.style.background =
        "linear-gradient(90deg, rgba(25,118,210,0.12), rgba(30,136,229,0.06))";
      el.style.color = "#0b66d1";
      el.style.boxShadow = "0 8px 22px rgba(11,102,209,0.12)";
    } catch (err) {
      posawesome_logger.error("Customer.vue", "buttonHoverEnter error", err);
    }
  },

  buttonHoverLeave(e) {
    try {
      const el = e.currentTarget;
      if (el.disabled) return;
      el.style.background = el.dataset._origBg || "";
      el.style.color = el.dataset._origColor || "";
      el.style.boxShadow = el.dataset._origBox || "";
      delete el.dataset._origBg;
      delete el.dataset._origColor;
      delete el.dataset._origBox;
    } catch (err) {
      posawesome_logger.error("Customer.vue", "buttonHoverLeave error", err);
    }
  },
};

export default comp;
</script>

<style>
/* Zebra striping for customer list */
.customer-item[data-even="true"] {
  background-color: rgba(249, 250, 251, 1) !important;
}

.customer-item[data-even="false"] {
  background-color: rgba(255, 255, 255, 1) !important;
}

/* Hover effect */
.customer-item:hover {
  background-color: rgba(25, 118, 210, 0.12) !important;
  transition: background-color 150ms ease;
}

/* Selected item */
.customer-item[data-selected="true"] {
  background-color: rgba(25, 118, 210, 0.08) !important;
}

/* Selected + Hover */
.customer-item[data-selected="true"]:hover {
  background-color: rgba(25, 118, 210, 0.16) !important;
}
</style>
