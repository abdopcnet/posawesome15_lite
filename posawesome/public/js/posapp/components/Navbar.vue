<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- NAVBAR COMPONENT -->
  <!-- =========================================== -->
  <nav>
    <div
      style="
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border-bottom: 1px solid #e0e0e0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        height: 32px;
        position: sticky;
        top: 0;
        z-index: 1100;
      "
    >
      <!-- =========================================== -->
      <!-- LOGO/TITLE -->
      <!-- =========================================== -->
      <div
        @click="go_desk"
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 8px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
        "
        title="Go to Desk"
      >
        <i class="mdi mdi-point-of-sale" style="font-size: 16px; color: var(--primary)"></i>
      </div>

      <!-- =========================================== -->
      <!-- INFO BADGES -->
      <!-- =========================================== -->
      <div style="flex: 1; display: flex; align-items: center; gap: 3px; overflow-x: auto; scrollbar-width: none">
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          :style="
            invoiceNumberClass === 'regular-invoice'
              ? 'border-color: rgba(8, 86, 152, 0.85); background: linear-gradient(135deg, #d4e8ff 0%, #93b9ff 100%); color: #043a8b; box-shadow: 0 8px 24px rgba(8,86,152,0.12); transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : invoiceNumberClass === 'return-invoice' || invoiceNumberClass === 'return-invoice-mode'
              ? `border-color: ${invoiceIconColor}; background: ${invoiceIconColor}; color: white; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;`
              : invoiceNumberClass === 'quick-return-mode'
              ? `border-color: ${invoiceIconColor}; background: ${invoiceIconColor}; color: white; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;`
              : invoiceNumberClass === 'sales-invoice-mode'
              ? `border-color: ${invoiceIconColor}; background: ${invoiceIconColor}; color: white; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;`
              : 'border-color: rgba(63, 81, 181, 0.75); background: linear-gradient(135deg, #eef3ff 0%, #d9e4ff 100%); color: #22314f; font-style: normal; box-shadow: 0 6px 18px rgba(34,49,79,0.06); transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
          "
          style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 6px;
            border: 1px solid;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            line-height: 1;
            height: 26px;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-receipt" :style="`font-size: 13px; color: ${invoiceIconColor}`"></i>
          <span style="color: inherit; font-weight: 700; font-size: 0.85rem">{{ invoiceNumberText }}</span>
        </div>

        <!-- Shift Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          :style="
            shiftNumberClass === 'open-shift'
              ? 'border-color: rgba(76, 175, 80, 0.50); background: linear-gradient(135deg, #eefbe7 0%, #def2da 100%); color: #2e7d32; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : shiftNumberClass === 'closed-shift'
              ? 'border-color: rgba(255, 152, 0, 0.30); background: linear-gradient(135deg, #fffaf3 0%, #fff0d6 100%); color: #000000b0; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : 'border-color: rgba(189, 189, 189, 0.65); background: #f9f9f9; color: #757575; font-style: italic; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
          "
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid;
            background: #fff;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-clock-outline" :style="`font-size: 12px; color: ${shiftIconColor}`"></i>
          <span>{{ shiftNumberText }}</span>
        </div>

        <!-- User Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(25, 118, 210, 0.5);
            background: linear-gradient(135deg, #eaf4ff 0%, #dbeeff 100%);
            color: #1976d2;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease,
              color 120ms ease;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-account" style="font-size: 12px; color: var(--primary)"></i>
          <span>{{ currentUserName }}</span>
        </div>

        <!-- Shift Start Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          :style="
            shiftStartClass === 'shift-active'
              ? 'border-color: rgba(76, 175, 80, 0.50); background: linear-gradient(135deg, #eefbe7 0%, #def2da 100%); color: #2e7d32; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : 'border-color: rgba(189, 189, 189, 0.65); background: #f9f9f9; color: #757575; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
          "
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid;
            background: #fff;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-clock-start" :style="`font-size: 12px; color: ${shiftStartIconColor}`"></i>
          <span>{{ shiftStartText }}</span>
        </div>

        <!-- Totals Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(25, 118, 210, 0.5);
            background: linear-gradient(135deg, #eaf4ff 0%, #dbeeff 100%);
            color: #1976d2;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease,
              color 120ms ease;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-counter" style="font-size: 12px; color: var(--primary)"></i>
          <span>QTY: {{ totalInvoicesQty }}</span>
        </div>

        <!-- Cash Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(76, 175, 80, 0.5);
            background: linear-gradient(135deg, #eefbe7 0%, #def2da 100%);
            color: #2e7d32;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease,
              color 120ms ease;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-cash-multiple" style="font-size: 12px; color: var(--success)"></i>
          <span>{{ formatCurrency(totalCash) }}</span>
        </div>

        <!-- Card Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(156, 39, 176, 0.3);
            background: linear-gradient(135deg, #f8eefb 0%, #f0e1f6 100%);
            color: #9033b7;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease,
              color 120ms ease;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-credit-card" style="font-size: 12px; color: var(--primary)"></i>
          <span>{{ formatCurrency(totalNonCash) }}</span>
        </div>

        <!-- Ping Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          :style="
            pingClass === 'ping-excellent'
              ? 'border-color: rgba(76, 175, 80, 0.50); background: linear-gradient(135deg, #eefbe7 0%, #def2da 100%); color: #2e7d32; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : pingClass === 'ping-good'
              ? 'border-color: rgba(33, 150, 243, 0.50); background: linear-gradient(135deg, #eaf4ff 0%, #dbeeff 100%); color: #1976d2; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : pingClass === 'ping-fair'
              ? 'border-color: rgba(255, 152, 0, 0.50); background: linear-gradient(135deg, #fff9ed 0%, #fff1d6 100%); color: #f57c00; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
              : 'border-color: rgba(244, 67, 54, 0.50); background: linear-gradient(135deg, #fff6f6 0%, #ffe6e6 100%); color: #d32f2f; transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease, color 120ms ease;'
          "
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid;
            background: #fff;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-wifi" :style="`font-size: 12px; color: ${pingIconColor}`"></i>
          <span>{{ pingTime }}ms</span>
        </div>

        <!-- Profile Badge -->
        <div
          @mouseenter="badgeMouseEnter"
          @mouseleave="badgeMouseLeave"
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(25, 118, 210, 0.5);
            background: linear-gradient(135deg, #eaf4ff 0%, #dbeeff 100%);
            color: #1976d2;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
            transition: box-shadow 140ms ease, filter 120ms ease, background-color 120ms ease, border-color 120ms ease,
              color 120ms ease;
            box-sizing: border-box;
          "
        >
          <i class="mdi mdi-briefcase" style="font-size: 12px; color: var(--primary)"></i>
          <span>{{ pos_profile.name }}</span>
        </div>
      </div>

      <!-- =========================================== -->
      <!-- ACTION BUTTONS -->
      <!-- =========================================== -->
      <div style="display: flex; align-items: center; gap: 3px">
        <!-- Print Button: Print Last Receipt or No last receipt -->
        <button
          :disabled="!last_invoice"
          :title="last_invoice ? 'طباعة آخر إيصال' : 'لا يوجد إيصال'"
          @click="print_last_invoice"
          :style="{
            cursor: last_invoice ? 'pointer' : 'not-allowed',
            opacity: last_invoice ? 1 : 0.6,
          }"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid rgba(25, 118, 210, 0.12);
            background: linear-gradient(90deg, rgba(25, 118, 210, 0.12), rgba(30, 136, 229, 0.08));
            font-size: 11px;
            font-weight: 600;
            height: 24px;
            min-width: 24px;
            transition: all 140ms ease;
            box-sizing: border-box;
          "
          @mouseenter="
            $event.currentTarget.disabled ||
              (($event.currentTarget.style.boxShadow = '0 8px 24px rgba(14,50,100,0.08)'),
              ($event.currentTarget.style.background =
                'linear-gradient(90deg, rgba(25,118,210,0.24), rgba(30,136,229,0.22))'))
          "
          @mouseleave="
            $event.currentTarget.disabled ||
              (($event.currentTarget.style.boxShadow = ''),
              ($event.currentTarget.style.background =
                'linear-gradient(90deg, rgba(25,118,210,0.12), rgba(30,136,229,0.08))'))
          "
          aria-label="Print last receipt"
        >
          <i
            class="mdi mdi-printer"
            :style="`font-size: 19px; color: ${last_invoice ? 'blue' : 'var(--gray-500)'}; filter: ${
              last_invoice ? 'drop-shadow(0 6px 14px rgba(25,118,210,0.12))' : 'none'
            }`"
          ></i>
        </button>

        <!-- Cache Button: Clear Cache -->
        <button
          @click="clearCache"
          title="مسح الذاكرة المؤقتة"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid rgba(255, 160, 0, 0.1);
            background: linear-gradient(90deg, rgba(255, 193, 7, 0.18), rgba(255, 152, 0, 0.12));
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            height: 24px;
            min-width: 24px;
            transition: all 140ms ease;
            box-sizing: border-box;
          "
          @mouseenter="
            $event.currentTarget.style.boxShadow = '0 8px 24px rgba(80,40,0,0.06)';
            $event.currentTarget.style.background =
              'linear-gradient(90deg, rgba(255,193,7,0.36), rgba(255,152,0,0.24))';
          "
          @mouseleave="
            $event.currentTarget.style.boxShadow = '';
            $event.currentTarget.style.background =
              'linear-gradient(90deg, rgba(255,193,7,0.18), rgba(255,152,0,0.12))';
          "
          aria-label="Clear cache"
        >
          <i
            class="mdi mdi-cached"
            style="font-size: 19px; color: #2264d4; filter: drop-shadow(0 6px 14px rgba(255, 152, 0, 0.12))"
          ></i>
        </button>

        <!-- Close Shift Button: Close Shift -->
        <button
          v-if="!pos_profile.posa_hide_closing_shift"
          @click="close_shift_dialog"
          title="إغلاق الوردية"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid rgba(244, 67, 54, 0.2);
            background: linear-gradient(90deg, rgba(244, 67, 54, 0.15), rgba(211, 47, 47, 0.1));
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            height: 24px;
            min-width: 24px;
            transition: all 140ms ease;
            box-sizing: border-box;
          "
          @mouseenter="
            $event.currentTarget.style.boxShadow = '0 8px 24px rgba(244,67,54,0.15)';
            $event.currentTarget.style.background = 'linear-gradient(90deg, rgba(244,67,54,0.25), rgba(211,47,47,0.2))';
          "
          @mouseleave="
            $event.currentTarget.style.boxShadow = '';
            $event.currentTarget.style.background = 'linear-gradient(90deg, rgba(244,67,54,0.15), rgba(211,47,47,0.1))';
          "
          aria-label="Close shift"
        >
          <i
            class="mdi mdi-close-circle"
            style="font-size: 19px; color: #d32f2f; filter: drop-shadow(0 6px 14px rgba(244, 67, 54, 0.15))"
          ></i>
        </button>
      </div>
    </div>

    <!-- Snackbar -->
    <div
      v-if="snack"
      :style="
        snackColor === 'success'
          ? 'background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); border: 1px solid #4caf50'
          : snackColor === 'error'
          ? 'background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); border: 1px solid #f44336'
          : snackColor === 'info'
          ? 'background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); border: 1px solid #2196f3'
          : 'background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border: 1px solid #ff9800'
      "
      @click="snack = false"
      style="
        position: fixed;
        top: 40px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 300px;
        max-width: 500px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        z-index: 2000;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideDown 0.3s ease-out;
        text-align: center;
      "
    >
      {{ snackText }}
    </div>

    <!-- Modal Overlay -->
    <div
      v-if="freeze"
      style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
      "
    >
      <div
        style="
          background: white;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        "
      >
        <div style="padding: 20px; border-bottom: 1px solid #e0e0e0">
          <h3 style="margin: 0; color: #333; font-size: 18px; font-weight: 600">
            {{ freezeTitle }}
          </h3>
        </div>
        <div style="padding: 20px; color: #666; line-height: 1.5">
          {{ freezeMsg }}
        </div>
      </div>
    </div>
  </nav>
</template>

<script src="./Navbar.js" />
