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
      <div
        style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 3px;
          overflow-x: auto;
          scrollbar-width: none;
        "
      >
        <!-- Invoice Badge -->
        <div
          :style="
            invoiceNumberClass === 'regular-invoice'
              ? 'border-color: rgba(25, 118, 210, 0.62); background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1976d2'
              : invoiceNumberClass === 'return-invoice'
                ? 'border-color: rgba(211, 47, 47, 0.62); background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); color: #d32f2f'
                : 'border-color: rgba(189, 189, 189, 0.8); background: #f5f5f5; color: #757575; font-style: italic'
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
          "
        >
          <i class="mdi mdi-receipt" :style="`font-size: 12px; color: ${invoiceIconColor}`"></i>
          <span>{{ invoiceNumberText }}</span>
        </div>

        <!-- Shift Badge -->
        <div
          :style="
            shiftNumberClass === 'open-shift'
              ? 'border-color: rgba(76, 175, 80, 0.62); background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); color: #2e7d32'
              : shiftNumberClass === 'closed-shift'
                ? 'border-color: rgba(255, 152, 0, 0.33); background: linear-gradient(135deg, #fffaf3 0%, #ff870a59 100%); color: #000000b0'
                : 'border-color: rgba(189, 189, 189, 0.8); background: #f5f5f5; color: #757575; font-style: italic'
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
          "
        >
          <i class="mdi mdi-clock-outline" :style="`font-size: 12px; color: ${shiftIconColor}`"></i>
          <span>{{ shiftNumberText }}</span>
        </div>

        <!-- User Badge -->
        <div
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(25, 118, 210, 0.56);
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            color: #1976d2;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
          "
        >
          <i class="mdi mdi-account" style="font-size: 12px; color: var(--primary)"></i>
          <span>{{ currentUserName }}</span>
        </div>

        <!-- Shift Start Badge -->
        <div
          :style="
            shiftStartClass === 'shift-active'
              ? 'border-color: rgba(76, 175, 80, 0.56); background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); color: #2e7d32'
              : 'border-color: rgba(189, 189, 189, 0.8); background: #f5f5f5; color: #757575'
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
          "
        >
          <i
            class="mdi mdi-clock-start"
            :style="`font-size: 12px; color: ${shiftStartIconColor}`"
          ></i>
          <span>{{ shiftStartText }}</span>
        </div>

        <!-- Totals Badge -->
        <div
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(25, 118, 210, 0.56);
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            color: #1976d2;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
          "
        >
          <i class="mdi mdi-counter" style="font-size: 12px; color: var(--primary)"></i>
          <span>QTY: {{ totalInvoicesQty }}</span>
        </div>

        <!-- Cash Badge -->
        <div
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(76, 175, 80, 0.56);
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
            color: #2e7d32;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
          "
        >
          <i class="mdi mdi-cash-multiple" style="font-size: 12px; color: var(--success)"></i>
          <span>{{ formatCurrency(totalCash) }}</span>
        </div>

        <!-- Card Badge -->
        <div
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(156, 39, 176, 0.29);
            background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7ab 100%);
            color: #9033b7;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
          "
        >
          <i class="mdi mdi-credit-card" style="font-size: 12px; color: var(--primary)"></i>
          <span>{{ formatCurrency(totalNonCash) }}</span>
        </div>

        <!-- Ping Badge -->
        <div
          :style="
            pingClass === 'ping-excellent'
              ? 'border-color: rgba(76, 175, 80, 0.56); background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); color: #2e7d32'
              : pingClass === 'ping-good'
                ? 'border-color: rgba(33, 150, 243, 0.56); background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1976d2'
                : pingClass === 'ping-fair'
                  ? 'border-color: rgba(255, 152, 0, 0.56); background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); color: #f57c00'
                  : 'border-color: rgba(244, 67, 54, 0.56); background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); color: #d32f2f'
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
          "
        >
          <i class="mdi mdi-wifi" :style="`font-size: 12px; color: ${pingIconColor}`"></i>
          <span>{{ pingTime }}ms</span>
        </div>

        <!-- Profile Badge -->
        <div
          style="
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(25, 118, 210, 0.56);
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            color: #1976d2;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            line-height: 1;
            height: 22px;
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
        <!-- Print Button -->
        <button
          :disabled="!last_invoice"
          :title="last_invoice ? __('Print Last Receipt') : __('No last receipt')"
          @click="print_last_invoice"
          :style="!last_invoice ? 'opacity: 0.4; cursor: not-allowed' : ''"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 3px 6px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background: #fff;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            height: 24px;
            min-width: 24px;
            transition: all 0.2s;
          "
        >
          <i
            class="mdi mdi-printer"
            :style="`font-size: 14px; color: ${last_invoice ? 'var(--primary)' : 'var(--gray-500)'}`"
          ></i>
        </button>

        <!-- Cache Button -->
        <button
          @click="clearCache"
          :title="__('Clear Cache')"
          style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 3px 6px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background: #fff;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            height: 24px;
            min-width: 24px;
            transition: all 0.2s;
          "
        >
          <i class="mdi mdi-cached" style="font-size: 14px; color: var(--warning)"></i>
        </button>

        <!-- Menu Dropdown -->
        <div style="display: flex">
          <button
            @click="toggleMenu"
            style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 3px;
              padding: 3px 6px;
              border: 1px solid #1976d2;
              border-radius: 4px;
              background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
              color: white;
              cursor: pointer;
              font-size: 11px;
              font-weight: 600;
              height: 24px;
              min-width: 24px;
            "
          >
            <i class="mdi mdi-menu" style="font-size: 14px"></i>
            <span style="color: white">{{ __('Menu') }}</span>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showMenu"
            style="
              position: absolute;
              top: 100%;
              right: 0;
              background: white;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
              z-index: 1200;
              min-width: 200px;
              margin-top: 4px;
              overflow: hidden;
              display: block !important;
              max-width: calc(100vw - 10px);
            "
          >
            <div style="padding: 4px; background: white">
              <!-- Close Shift -->
              <div
                v-if="!pos_profile.posa_hide_closing_shift && menu_item == 0"
                @click="close_shift_dialog"
                style="
                  display: flex;
                  align-items: center;
                  padding: 8px 12px;
                  cursor: pointer;
                  transition: background-color 0.2s ease;
                  border-radius: 6px;
                  margin: 2px 0;
                  min-height: 40px;
                "
              >
                <div
                  style="
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                    color: white;
                    transition: all 0.2s ease;
                  "
                >
                  <i class="mdi mdi-content-save-move-outline" style="font-size: 16px"></i>
                </div>
                <div
                  style="font-size: 0.875rem; font-weight: 600; color: #333; letter-spacing: 0.2px"
                >
                  {{ __('Close Shift') }}
                </div>
              </div>

              <!-- Logout -->
              <div
                @click="logOut"
                style="
                  display: flex;
                  align-items: center;
                  padding: 8px 12px;
                  cursor: pointer;
                  transition: background-color 0.2s ease;
                  border-radius: 6px;
                  margin: 2px 0;
                  min-height: 40px;
                "
              >
                <div
                  style="
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                    color: white;
                    transition: all 0.2s ease;
                  "
                >
                  <i class="mdi mdi-logout" style="font-size: 16px"></i>
                </div>
                <div
                  style="font-size: 0.875rem; font-weight: 600; color: #333; letter-spacing: 0.2px"
                >
                  {{ __('Logout') }}
                </div>
              </div>

              <!-- About -->
              <div
                @click="go_about"
                style="
                  display: flex;
                  align-items: center;
                  padding: 8px 12px;
                  cursor: pointer;
                  transition: background-color 0.2s ease;
                  border-radius: 6px;
                  margin: 2px 0;
                  min-height: 40px;
                "
              >
                <div
                  style="
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
                    color: white;
                    transition: all 0.2s ease;
                  "
                >
                  <i class="mdi mdi-information-outline" style="font-size: 16px"></i>
                </div>
                <div
                  style="font-size: 0.875rem; font-weight: 600; color: #333; letter-spacing: 0.2px"
                >
                  {{ __('About System') }}
                </div>
              </div>
            </div>
          </div>
        </div>
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
