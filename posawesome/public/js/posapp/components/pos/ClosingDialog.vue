<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- CLOSING DIALOG -->
  <!-- =========================================== -->
  <div style="display: flex; justify-content: center; align-items: center">
    <!-- Modal Overlay -->
    <div
      v-if="closingDialog"
      @click="close_dialog"
      style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 5vh;
        z-index: 1050 !important;
        animation: modal-fade-in 0.2s ease;
      "
    >
      <!-- Dialog -->
      <div
        @click.stop
        style="
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          max-width: 95vw;
          min-width: 700px;
          width: auto;
          animation: dialogSlideIn 0.3s ease-out;
          border: 1px solid rgba(255, 152, 0, 0.1);
        "
      >
        <!-- =========================================== -->
        <!-- DIALOG HEADER -->
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
              <i
                class="mdi mdi-cash-register"
                style="color: white; font-size: 18px"
              ></i>
            </div>
            <h3
              style="
                margin: 0;
                font-size: 20px;
                font-weight: 700;
                color: white;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                position: relative;
                z-index: 2;
              "
            >
              <!-- Close POS -->
              إغلاق نقطة البيع
            </h3>
          </div>

          <button
            @click="close_dialog"
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
          >
            <i class="mdi mdi-close" style="color: white; font-size: 14px"></i>
          </button>
        </div>

        <!-- =========================================== -->
        <!-- DIALOG CONTENT -->
        <!-- =========================================== -->
        <div v-if="pos_profile" style="padding: 8px; background: #fafbfc">
          <!-- Payment Table -->
          <div
            style="
              background: white;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #e8eaed;
            "
          >
            <!-- Table Header -->
            <div
              style="
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                background: #f8fafc;
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
                <!-- Method -->
                الطريقة
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
                <!-- System -->
                النظام
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
                <!-- Actual -->
                الفعلي
              </div>
              <div
                v-if="!pos_profile.posa_hide_expected_amount"
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
                <!-- Expected -->
                المتوقع
              </div>
              <div
                v-if="!pos_profile.posa_hide_expected_amount"
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
                <!-- Diff -->
                الفرق
              </div>
            </div>

            <!-- Table Body -->
            <div>
              <div
                v-for="(item, index) in dialog_data.payment_reconciliation"
                :key="item.mode_of_payment"
                style="
                  display: grid;
                  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                  border-bottom: 1px solid #f1f5f9;
                  transition: background-color 0.1s ease;
                "
                :style="index % 2 === 0 ? '' : 'background: #fafbfc'"
              >
                <!-- Method -->
                <div
                  style="
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    font-size: 12px;
                    min-height: 32px;
                  "
                >
                  <div style="display: flex; align-items: center; gap: 6px">
                    <i
                      class="mdi mdi-cash-multiple"
                      style="font-size: 14px; color: #ff6f00; flex-shrink: 0"
                    ></i>
                    <span
                      style="
                        font-weight: 500;
                        color: #334155;
                        font-size: 11px;
                        white-space: nowrap;
                      "
                    >
                      {{ item.mode_of_payment }}
                    </span>
                  </div>
                </div>

                <!-- System Amount -->
                <div
                  style="
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    font-size: 12px;
                    min-height: 32px;
                  "
                >
                  <span
                    style="
                      font-weight: 600;
                      color: #1e293b;
                      font-size: 11px;
                      font-family: monospace;
                    "
                  >
                    {{ formatCurrency(item.opening_amount) }}
                  </span>
                </div>

                <!-- Actual Amount (Editable) -->
                <div
                  style="
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    font-size: 12px;
                    min-height: 32px;
                  "
                >
                  <div
                    v-if="item.editing"
                    style="
                      background: white;
                      border: 1px solid #6366f1;
                      border-radius: 4px;
                      padding: 2px 6px;
                      font-size: 11px;
                      font-weight: 600;
                      font-family: monospace;
                      width: 70px;
                      text-align: right;
                      outline: none;
                    "
                  >
                    <input
                      v-model="item.closing_amount"
                      type="number"
                      :required="
                        item.expected_amount && item.expected_amount > 0
                      "
                      @blur="item.editing = false"
                      @keyup.enter="item.editing = false"
                      style="
                        width: 100%;
                        border: none;
                        outline: none;
                        background: transparent;
                        text-align: right;
                        font-size: 11px;
                        font-weight: 600;
                        font-family: monospace;
                      "
                    />
                  </div>

                  <div
                    v-else
                    @click="item.editing = true"
                    style="
                      cursor: pointer;
                      padding: 2px 4px;
                      border-radius: 3px;
                      transition: all 0.1s ease;
                      background: rgba(99, 102, 241, 0.05);
                    "
                  >
                    <span
                      style="
                        font-weight: 600;
                        font-size: 11px;
                        font-family: monospace;
                      "
                      :style="
                        item.expected_amount &&
                        item.expected_amount > 0 &&
                        (!item.closing_amount ||
                          item.closing_amount === null ||
                          item.closing_amount === undefined ||
                          item.closing_amount === '' ||
                          item.closing_amount === 0)
                          ? 'color: #dc2626'
                          : 'color: #1e293b'
                      "
                    >
                      {{
                        item.closing_amount !== null &&
                        item.closing_amount !== undefined &&
                        item.closing_amount !== "" &&
                        item.closing_amount !== 0
                          ? formatCurrency(item.closing_amount)
                          : "---"
                      }}
                    </span>
                    <i
                      class="mdi mdi-pencil"
                      style="
                        opacity: 0;
                        transition: opacity 0.1s ease;
                        color: #6366f1;
                        margin-left: 2px;
                        font-size: 10px;
                      "
                    ></i>
                  </div>
                </div>

                <!-- Expected Amount -->
                <div
                  v-if="!pos_profile.posa_hide_expected_amount"
                  style="
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    font-size: 12px;
                    min-height: 32px;
                  "
                >
                  <span
                    style="
                      font-weight: 600;
                      color: #1e293b;
                      font-size: 11px;
                      font-family: monospace;
                    "
                  >
                    {{ formatCurrency(item.expected_amount) }}
                  </span>
                </div>

                <!-- Difference -->
                <div
                  v-if="!pos_profile.posa_hide_expected_amount"
                  style="
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 4px;
                    font-size: 12px;
                    min-height: 32px;
                  "
                >
                  <template
                    v-if="
                      item.closing_amount !== null &&
                      item.closing_amount !== undefined &&
                      item.closing_amount !== '' &&
                      item.closing_amount !== 0
                    "
                  >
                    <!-- الفعلي > المتوقع: أخضر + سهم لأعلى -->
                    <span
                      v-if="item.closing_amount > item.expected_amount"
                      style="
                        font-weight: 600;
                        font-size: 11px;
                        font-family: monospace;
                        color: #059669;
                        display: flex;
                        align-items: center;
                        gap: 3px;
                      "
                    >
                      <i
                        class="mdi mdi-arrow-up"
                        style="font-size: 12px; color: #059669"
                      ></i>
                      {{
                        formatCurrency(
                          item.closing_amount - item.expected_amount
                        )
                      }}
                    </span>
                    <!-- الفعلي < المتوقع: أحمر + سهم لأسفل -->
                    <span
                      v-else-if="item.closing_amount < item.expected_amount"
                      style="
                        font-weight: 600;
                        font-size: 11px;
                        font-family: monospace;
                        color: #dc2626;
                        display: flex;
                        align-items: center;
                        gap: 3px;
                      "
                    >
                      <i
                        class="mdi mdi-arrow-down"
                        style="font-size: 12px; color: #dc2626"
                      ></i>
                      {{
                        formatCurrency(
                          item.expected_amount - item.closing_amount
                        )
                      }}
                    </span>
                    <!-- الفعلي = المتوقع: رمادي -->
                    <span
                      v-else
                      style="
                        font-weight: 600;
                        font-size: 11px;
                        font-family: monospace;
                        color: #64748b;
                      "
                    >
                      {{ formatCurrency(0) }}
                    </span>
                  </template>
                  <!-- الحقل فارغ -->
                  <span
                    v-else
                    style="
                      font-weight: 600;
                      font-size: 11px;
                      font-family: monospace;
                      color: #dc2626;
                    "
                  >
                    ---
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- DIALOG FOOTER -->
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
          <!-- Cancel Button -->
          <button
            @click="close_dialog"
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
          >
            <!-- Cancel -->
            <i class="mdi mdi-close" style="font-size: 14px"></i>
            إلغاء
          </button>

          <!-- Submit Button -->
          <button
            v-if="isClosingAllowed && isAllRequiredFieldsFilled"
            @click="submit_dialog"
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
          >
            <!-- Submit -->
            <i class="mdi mdi-check" style="font-size: 14px"></i>
            تأكيد
          </button>

          <!-- Time Restriction Message -->
          <div
            v-if="!isClosingAllowed && closingTimeMessage"
            style="
              display: flex;
              align-items: center;
              gap: 8px;
              color: #f59e0b;
              font-size: 12px;
              font-weight: 500;
              padding: 8px 12px;
              background: rgba(245, 158, 11, 0.1);
              border-radius: 6px;
              border: 1px solid rgba(245, 158, 11, 0.2);
            "
          >
            <i
              class="mdi mdi-clock-alert-outline"
              style="color: #ff9800; font-size: 14px"
            ></i>
            {{ closingTimeMessage }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./ClosingDialog.js" />
