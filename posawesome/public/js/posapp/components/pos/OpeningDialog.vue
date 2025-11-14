<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- OPENING DIALOG COMPONENT -->
  <!-- =========================================== -->
  <div style="display: flex; justify-content: center; align-items: center">
    <div
      v-if="isOpen"
      style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      "
      @click="go_desk"
    >
      <!-- Beautiful Dialog -->
      <div
        style="
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          max-width: 450px;
          width: 100%;
          animation: dialogSlideIn 0.3s ease-out;
          border: 1px solid rgba(102, 126, 234, 0.1);
        "
        @click.stop
      >
        <!-- =========================================== -->
        <!-- COMPACT HEADER -->
        <!-- =========================================== -->
        <div
          style="
            background: linear-gradient(135deg, #ff6f00 0%, #ff9800 100%);
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
            position: relative;
            overflow: hidden;
          "
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <div
              style="
                width: 28px;
                height: 28px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <i class="mdi mdi-cash-register" style="color: white; font-size: 18px"></i>
            </div>

            <h3
              style="
                margin: 0;
                font-size: 16px;
                font-weight: 700;
                color: white;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                position: relative;
                z-index: 2;
              "
            >
              POS Opening
            </h3>
          </div>

          <button
            style="
              background: rgba(255, 255, 255, 0.15);
              border: none;
              border-radius: 4px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease;
            "
            @click="go_desk"
          >
            <i class="mdi mdi-close" style="color: white; font-size: 14px"></i>
          </button>
        </div>

        <!-- =========================================== -->
        <!-- COMPACT CONTENT -->
        <!-- =========================================== -->
        <div style="padding: 12px; background: #fafbfc">
          <!-- Company Selection -->
          <div style="margin-bottom: 12px">
            <label
              style="
                display: block;
                font-size: 11px;
                font-weight: 600;
                color: #475569;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              "
            >
              Company
            </label>
            <select
              v-model="company"
              required
              style="
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                background: white;
                color: #374151;
                outline: none;
                transition: all 0.2s ease;
              "
            >
              <option v-for="comp in companies" :key="comp" :value="comp">{{ comp }}</option>
            </select>
          </div>

          <!-- POS Profile Selection -->
          <div style="margin-bottom: 12px">
            <label
              style="
                display: block;
                font-size: 11px;
                font-weight: 600;
                color: #475569;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              "
            >
              POS Profile
            </label>
            <select
              v-model="pos_profile"
              required
              style="
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                background: white;
                color: #374151;
                outline: none;
                transition: all 0.2s ease;
              "
            >
              <option v-for="profile in pos_profiles" :key="profile" :value="profile">
                {{ profile }}
              </option>
            </select>
          </div>

          <!-- Payment Methods Table -->
          <div style="margin-bottom: 0">
            <label
              style="
                display: block;
                font-size: 11px;
                font-weight: 600;
                color: #475569;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              "
            >
              Payment Methods
            </label>
            <div
              style="
                background: white;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid #e8eaed;
                margin-top: 6px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              "
            >
              <!-- Table Header -->
              <div
                style="
                  display: grid;
                  grid-template-columns: 2fr 1fr;
                  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                  border-bottom: 1px solid #e2e8f0;
                "
              >
                <div
                  style="
                    padding: 6px 8px;
                    font-size: 10px;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                  "
                >
                  Payment Method
                </div>

                <div
                  style="
                    padding: 6px 8px;
                    font-size: 10px;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                  "
                >
                  Opening Amount
                </div>
              </div>

              <!-- Table Body -->
              <div>
                <div
                  v-for="(item, index) in payments_methods"
                  :key="item.mode_of_payment"
                  style="
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.1s ease;
                  "
                  :style="index === payments_methods.length - 1 ? 'border-bottom: none' : ''"
                >
                  <!-- Method Column -->
                  <div
                    style="
                      padding: 8px;
                      display: flex;
                      align-items: center;
                      font-size: 12px;
                      min-height: 36px;
                      justify-content: flex-start;
                    "
                  >
                    <div style="display: flex; align-items: center; gap: 6px">
                      <i
                        class="mdi"
                        :class="getPaymentIcon(item.mode_of_payment).icon"
                        :style="{
                          color: getPaymentIcon(item.mode_of_payment).color,
                          fontSize: '14px',
                        }"
                      ></i>
                      <span style="font-weight: 500; color: #334155; font-size: 11px">
                        {{ item.mode_of_payment }}
                      </span>
                    </div>
                  </div>

                  <!-- Amount Column -->
                  <div
                    style="
                      padding: 8px;
                      display: flex;
                      align-items: center;
                      font-size: 12px;
                      min-height: 36px;
                      justify-content: flex-end;
                    "
                  >
                    <div
                      style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: white;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        padding: 2px 6px;
                        transition: all 0.2s ease;
                      "
                    >
                      <span style="font-size: 10px; color: #64748b; font-weight: 500">
                        {{ currencySymbol(item.currency) }}
                      </span>
                      <input
                        v-model="item.amount"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        style="
                          border: none;
                          outline: none;
                          font-size: 11px;
                          font-weight: 600;
                          font-family: monospace;
                          width: 60px;
                          text-align: right;
                          background: transparent;
                          color: #1e293b;
                        "
                        @focus="
                          (event) => {
                            event.target.parentElement.style.borderColor = '#6366f1';
                            event.target.parentElement.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
                          }
                        "
                        @blur="
                          (event) => {
                            event.target.parentElement.style.borderColor = '#d1d5db';
                            event.target.parentElement.style.boxShadow = 'none';
                          }
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- COMPACT FOOTER -->
        <!-- =========================================== -->
        <div
          style="
            background: #f8fafc;
            padding: 8px 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
          "
        >
          <button
            style="
              display: flex;
              align-items: center;
              gap: 4px;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              border: 1px solid #cbd5e1;
              background: #f1f5f9;
              color: #475569;
            "
            @click="go_desk"
          >
            <i class="mdi mdi-close" style="font-size: 14px"></i>
            Cancel
          </button>

          <button
            v-if="isOpeningAllowed"
            style="
              display: flex;
              align-items: center;
              gap: 4px;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              border: none;
              background: #10b981;
              color: white;
            "
            :style="{ opacity: is_loading ? 0.6 : 1 }"
            :disabled="is_loading"
            @click="submit_dialog"
          >
            <i class="mdi mdi-check" v-if="!is_loading" style="font-size: 14px"></i>
            <i class="mdi mdi-loading" v-else style="font-size: 14px; animation: rotate 1s linear infinite"></i>
            {{ is_loading ? "Creating..." : "Confirm" }}
          </button>

          <div
            v-else
            style="
              font-size: 11px;
              color: #dc2626;
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 6px;
              padding: 6px 10px;
              display: flex;
              align-items: center;
              font-weight: 500;
            "
          >
            {{ openingTimeMessage }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./OpeningDialog.js" />
