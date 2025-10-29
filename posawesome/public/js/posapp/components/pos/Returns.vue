<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- RETURNS DIALOG -->
  <!-- =========================================== -->
  <div style="display: flex; justify-content: center; align-items: center">
    <!-- Modal Overlay -->
    <div
      v-if="invoicesDialog"
      @click="invoicesDialog = false"
      style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: modal-fade-in 0.2s ease;
      "
    >
      <!-- Modal -->
      <div
        @click.stop
        style="
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 90vw;
          min-width: 600px;
          width: auto;
          max-height: 90vh;
          overflow: hidden;
          animation: modal-slide-in 0.3s ease;
        "
      >
        <!-- Card -->
        <div
          style="
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          "
        >
          <!-- =========================================== -->
          <!-- CARD HEADER -->
          <!-- =========================================== -->
          <div
            style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 16px;
              border-bottom: 1px solid #e0e0e0;
              position: relative;
            "
          >
            <span
              style="
                color: white;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 1.25rem;
                font-weight: 700;
                color: white;
              "
            >
              <i class="mdi mdi-keyboard-return" style="font-size: 18px"></i>
              Return Invoice
            </span>
            <button
              @click="invoicesDialog = false"
              style="
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                font-size: 1.5rem;
                color: white;
                cursor: pointer;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
              "
            >
              ×
            </button>
          </div>

          <!-- =========================================== -->
          <!-- CARD BODY -->
          <!-- =========================================== -->
          <div
            style="
              max-height: 60vh;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
              padding: 16px;
            "
          >
            <!-- Search Row -->
            <div style="display: flex; gap: 8px; margin-bottom: 12px">
              <!-- Invoice Number Input -->
              <div style="display: flex; flex-direction: column; gap: 4px; width: 100%; flex: 1">
                <label
                  style="font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 2px"
                >
                  Invoice Number
                </label>
                <input
                  type="text"
                  v-model="invoice_name"
                  placeholder="Invoice Number"
                  @keydown.enter="search_invoices"
                  style="
                    width: 100%;
                    padding: 8px 12px;
                    font-size: 0.85rem;
                    color: #333;
                    background: white;
                    border: 1px solid #d0d0d0;
                    border-radius: 6px;
                    outline: none;
                    transition: all 0.2s ease;
                  "
                />
              </div>

              <!-- Search Button -->
              <button
                @click="search_invoices"
                style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  padding: 8px 16px;
                  height: 40px;
                  font-size: 12px;
                  font-weight: 500;
                  cursor: pointer;
                  border: 1px solid;
                  transition: all 0.2s ease;
                  line-height: 1.5;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
                  color: white;
                  border-color: #1565c0;
                  border-radius: 6px;
                  margin-top: 20px;
                "
              >
                Search
              </button>
            </div>

            <!-- Table Container -->
            <div style="flex: 1; min-height: 0">
              <div style="max-height: 60vh; overflow-y: auto">
                <!-- Loading State -->
                <div
                  v-if="isLoading"
                  style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    gap: 12px;
                  "
                >
                  <div
                    style="
                      width: 40px;
                      height: 40px;
                      border: 4px solid #f3f3f3;
                      border-top: 4px solid #1976d2;
                      border-radius: 50%;
                      animation: spin 1s linear infinite;
                    "
                  ></div>
                  <span style="font-size: 14px; color: #666"> Loading invoices... </span>
                </div>

                <!-- No Data -->
                <div
                  v-else-if="dialog_data.length === 0"
                  style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    color: #999;
                    font-size: 14px;
                  "
                >
                  No invoices found
                </div>

                <!-- Table -->
                <table
                  v-else
                  style="
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.875rem;
                    background: white;
                    table-layout: auto;
                  "
                >
                  <!-- Table Headers -->
                  <thead>
                    <tr style="border-bottom: 2px solid #e0e0e0; background: #f5f5f5">
                      <th
                        style="
                          padding: 10px;
                          text-align: left;
                          font-weight: 600;
                          color: #333;
                          font-size: 0.75rem;
                          text-transform: uppercase;
                          white-space: nowrap;
                        "
                      >
                        Select
                      </th>
                      <th
                        v-for="header in headers"
                        :key="header.key"
                        :style="{
                          padding: '10px',
                          textAlign: header.align || 'left',
                          fontWeight: '600',
                          color: '#333',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }"
                      >
                        {{ header.title }}
                      </th>
                    </tr>
                  </thead>

                  <!-- Table Body -->
                  <tbody>
                    <tr
                      v-for="item in dialog_data"
                      :key="item.name"
                      style="
                        border-bottom: 1px solid #f0f0f0;
                        transition: background-color 0.15s ease;
                      "
                      :style="`background: ${item.checked ? '#f0f7ff' : 'white'}`"
                    >
                      <!-- Radio Select -->
                      <td style="padding: 10px">
                        <input
                          type="radio"
                          :value="item.name"
                          v-model="selected"
                          name="invoice"
                          style="cursor: pointer"
                        />
                      </td>

                      <!-- Customer -->
                      <td style="padding: 10px; text-align: left; white-space: nowrap">
                        {{ item.customer }}
                      </td>

                      <!-- Posting Date -->
                      <td style="padding: 10px; text-align: left; white-space: nowrap">
                        {{ item.posting_date }}
                      </td>

                      <!-- Invoice Name -->
                      <td style="padding: 10px; text-align: left; white-space: nowrap">
                        {{ item.name }}
                      </td>

                      <!-- Grand Total -->
                      <td
                        style="
                          padding: 10px;
                          text-align: right;
                          font-weight: 600;
                          color: #1976d2;
                          white-space: nowrap;
                        "
                      >
                        {{ currencySymbol(item.currency) }} {{ formatCurrency(item.grand_total) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- =========================================== -->
          <!-- CARD FOOTER -->
          <!-- =========================================== -->
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: flex-end;
              gap: 8px;
              padding: 12px 16px;
              border-top: 1px solid #e0e0e0;
              flex-shrink: 0;
              margin-top: auto;
            "
          >
            <div style="flex: 1"></div>

            <!-- Close Button -->
            <button
              @click="close_dialog"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 6px 16px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid #d32f2f;
                transition: all 0.2s ease;
                line-height: 1.5;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                background: white;
                color: #d32f2f;
              "
            >
              Close
            </button>

            <!-- Select Button -->
            <button
              @click="submit_dialog"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 6px 16px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid #2e7d32;
                transition: all 0.2s ease;
                line-height: 1.5;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
                color: white;
              "
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./Returns.js" />
