<!-- @ngrie -->
<template>
  <div>
    <!-- =========================================== -->
    <!-- INVOICE CONTAINER -->
    <!-- =========================================== -->
    <div
      style="
        position: relative;
        min-height: 0;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: 100%;
      "
    >
      <!-- =========================================== -->
      <!-- CUSTOMER SECTION -->
      <!-- =========================================== -->
      <div style="padding: 4px 6px; border-bottom: 1px solid #e0e0e0; margin-bottom: 0">
        <Customer></Customer>
      </div>

      <!-- =========================================== -->
      <!-- ITEMS TABLE SECTION -->
      <!-- =========================================== -->
      <div
        ref="itemsScrollArea"
        :style="itemsScrollStyle"
        style="
          flex: 1;
          /* max-height: calc(100vh - 350px); */
          overflow-y: auto;
          overflow-x: hidden;
          /* padding-bottom: 10px; */
          padding: 0;
          display: block;
        "
      >
        <table
          style="
            width: 100%;
            border-collapse: collapse;
            background: white;
            font-size: 0.72rem;
            table-layout: fixed;
            /* make cells not wrap by default */
            white-space: nowrap;
          "
        >
          <!-- TABLE HEADERS -->
          <thead>
            <tr>
              <th
                v-for="header in dynamicHeaders"
                :key="header.key"
                style="
                  background: linear-gradient(
                    180deg,
                    rgba(128, 166, 255, 1) 0%,
                    rgba(128, 166, 255, 0.25) 50%
                  );
                  border-bottom: 1px solid #e0e0e0;
                  padding: 6px 8px;
                  font-weight: 600;
                  font-size: 0.72rem;
                  color: #424242;
                  position: sticky;
                  top: 0;
                  z-index: 1;
                  text-align: center;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                {{ header.title }}
              </th>
            </tr>
          </thead>

          <!-- TABLE ROWS - INVOICE ITEMS -->
          <tbody>
            <tr
              v-for="item in items"
              :key="item.posa_row_id"
              @mouseenter="
                $event.currentTarget.style.background = 'rgba(16,24,40,0.06)';
                $event.currentTarget.style.transition = 'background-color 120ms ease';
              "
              @mouseleave="
                $event.currentTarget.style.background = '';
                $event.currentTarget.style.transition = 'background-color 120ms ease';
              "
              style="
                border-bottom: 1px solid #f1f1f1;
                height: 40px;
                min-height: 40px;
                box-sizing: border-box;
                white-space: nowrap;
                overflow: hidden;
              "
            >
              <!-- ITEM NAME COLUMN -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'item_name')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  max-width: 1px; /* allow flex truncation */
                "
              >
                <!-- no-wrap + ellipsis -->
                <p
                  style="
                    margin-bottom: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: block;
                    max-width: 100%;
                  "
                  :title="item.item_name"
                >
                  {{ item.item_name }}
                </p>
              </td>

              <!-- QUANTITY COLUMN -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'qty')"
                style="padding: 6px 8px; vertical-align: middle; max-width: 92px; width: 92px"
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 0;
                    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                    border-radius: 4px;
                    width: 100%;
                    min-width: 0;
                    box-sizing: border-box;
                    overflow: hidden;
                    white-space: nowrap;
                  "
                >
                  <button
                    style="
                      flex-shrink: 0;
                      width: 28px;
                      height: 28px;
                      padding: 0;
                      border: none;
                      border-radius: 5px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 0.9rem;
                      color: white;
                      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                    "
                    @click="decreaseQuantity(item)"
                    :disabled="!(item.qty && Math.abs(item.qty) > 0)"
                    type="button"
                  >
                    −
                  </button>

                  <input
                    type="text"
                    :value="Math.abs(item.qty || 0)"
                    @input="onQtyInput(item, $event)"
                    @change="onQtyChange(item, $event)"
                    @blur="handleQtyBlur(item, $event)"
                    @wheel.prevent
                    @keydown="
                      if ($event.key === 'ArrowUp' || $event.key === 'ArrowDown') {
                        $event.preventDefault();
                        $event.stopPropagation();
                      }
                    "
                    style="
                      width: 44px;
                      border: 1px solid #1976d2;
                      background: white;
                      text-align: center;
                      font-size: 0.72rem;
                      margin: 0 4px;
                      padding: 3px 4px;
                      border-radius: 4px;
                      outline: none;
                      box-sizing: border-box;
                      -moz-appearance: textfield;
                      -webkit-appearance: none;
                      appearance: textfield;
                    "
                    placeholder="0"
                    inputmode="numeric"
                  />

                  <button
                    style="
                      flex-shrink: 0;
                      width: 28px;
                      height: 28px;
                      padding: 0;
                      border: none;
                      border-radius: 5px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 0.9rem;
                      color: white;
                      background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
                    "
                    @click="increaseQuantity(item)"
                    type="button"
                  >
                    +
                  </button>
                </div>
              </td>

              <!-- UOM COLUMN -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'uom')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  text-align: center;
                  max-width: 72px;
                  width: 72px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
                :title="item.uom"
              >
                {{ item.uom }}
              </td>

              <!-- PRICE LIST RATE COLUMN (Original Price) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'price_list_rate')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  max-width: 92px;
                  width: 92px;
                  overflow: hidden;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 4px;
                    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                    border-radius: 4px;
                    min-width: 0;
                    overflow: hidden;
                  "
                >
                  <span
                    style="
                      font-size: 0.75rem;
                      font-weight: 700;
                      color: #2e7d32;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    "
                  >
                    {{ formatCurrency(item.price_list_rate) }}
                  </span>
                </div>
              </td>

              <!-- RATE COLUMN (Discounted Price - Editable) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'rate')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  max-width: 110px;
                  width: 110px;
                  overflow: hidden;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 4px;
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    border-radius: 4px;
                    min-width: 0;
                    overflow: hidden;
                  "
                >
                  <input
                    type="text"
                    :value="formatCurrency(item.rate)"
                    @change="setItemRate(item, $event)"
                    @keyup.enter="setItemRate(item, $event)"
                    @blur="handleRateBlur(item, $event)"
                    :disabled="
                      Boolean(
                        item.posa_is_offer ||
                          item.posa_is_replace ||
                          item.posa_offer_applied ||
                          invoice_doc?.is_return,
                      )
                    "
                    :style="
                      Boolean(
                        item.posa_is_offer ||
                          item.posa_is_replace ||
                          item.posa_offer_applied ||
                          invoice_doc?.is_return,
                      )
                        ? 'width:100%; border:none; background:#f5f5f5; color:#9e9e9e; font-size:0.72rem; padding:4px; border-radius:4px; outline:none; text-align:center'
                        : 'width:100%; border:none; background:transparent; font-size:0.78rem; font-weight:700; color:#f57c00; padding:4px; outline:none; text-align:center'
                    "
                    placeholder="0.00"
                  />
                </div>
              </td>

              <!-- DISCOUNT PERCENTAGE COLUMN (Editable) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'discount_percentage')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  max-width: 90px;
                  width: 90px;
                  overflow: hidden;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 4px;
                    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    border-radius: 4px;
                    min-width: 0;
                    overflow: hidden;
                  "
                >
                  <input
                    type="number"
                    :value="formatFloat(item.discount_percentage || 0)"
                    @change="setDiscountPercentage(item, $event)"
                    @keyup.enter="setDiscountPercentage(item, $event)"
                    @blur="handleDiscountBlur(item, $event)"
                    :disabled="
                      Boolean(
                        item.posa_is_offer ||
                          item.posa_is_replace ||
                          item.posa_offer_applied ||
                          !pos_profile?.posa_allow_user_to_edit_item_discount ||
                          invoice_doc?.is_return,
                      )
                    "
                    :style="
                      Boolean(
                        item.posa_is_offer ||
                          item.posa_is_replace ||
                          item.posa_offer_applied ||
                          !pos_profile?.posa_allow_user_to_edit_item_discount ||
                          invoice_doc?.is_return,
                      )
                        ? 'width:100%; border:none; background:#f5f5f5; color:#9e9e9e; font-size:0.72rem; padding:4px; border-radius:4px; outline:none; text-align:center'
                        : 'width:100%; border:none; background:transparent; font-size:0.72rem; font-weight:700; color:#f57c00; padding:4px; outline:none; text-align:center'
                    "
                    placeholder="0"
                    min="0"
                    :max="pos_profile?.posa_item_max_discount_allowed || 100"
                    step="0.01"
                  />
                  <span
                    style="
                      font-size: 0.68rem;
                      font-weight: 700;
                      color: #f57c00;
                      white-space: nowrap;
                      flex-shrink: 0;
                    "
                    >%</span
                  >
                </div>
              </td>

              <!-- DISCOUNT AMOUNT COLUMN (Calculated) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'discount_amount')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  max-width: 92px;
                  width: 92px;
                  overflow: hidden;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 4px;
                    background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
                    border-radius: 4px;
                    min-width: 0;
                    overflow: hidden;
                  "
                >
                  <span
                    :style="{
                      fontSize: '0.76rem',
                      fontWeight: '700',
                      color: getDiscountAmount(item) > 0 ? '#f57c00' : '#9e9e9e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }"
                  >
                    {{ formatCurrency(getDiscountAmount(item)) }}
                  </span>
                </div>
              </td>

              <!-- TOTAL AMOUNT COLUMN (Calculated: Qty × Rate) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'amount')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  max-width: 110px;
                  width: 110px;
                  overflow: hidden;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 4px;
                    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                    border-radius: 4px;
                    min-width: 0;
                    overflow: hidden;
                  "
                >
                  <span
                    style="
                      font-size: 0.78rem;
                      font-weight: 700;
                      color: #1b5e20;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    "
                  >
                    {{
                      formatCurrency(
                        flt(item.qty, float_precision) * flt(item.rate, currency_precision),
                      )
                    }}
                  </span>
                </div>
              </td>

              <!-- ACTIONS COLUMN (Delete Button) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'actions')"
                style="
                  padding: 6px 8px;
                  vertical-align: middle;
                  width: 56px;
                  max-width: 56px;
                  text-align: center;
                  overflow: hidden;
                "
              >
                <div
                  style="display: flex; justify-content: center; align-items: center; height: 100%"
                >
                  <button
                    :disabled="Boolean(item.posa_is_offer || item.posa_is_replace)"
                    :style="
                      item.posa_is_offer || item.posa_is_replace
                        ? 'width:36px;height:36px;padding:0;border-radius:6px;border:none;background:#f3f3f3;color:#9e9e9e;display:flex;align-items:center;justify-content:center;cursor:not-allowed;opacity:0.6;transition:transform 140ms ease,box-shadow 140ms ease,background 140ms ease'
                        : 'width:36px;height:36px;padding:0;border-radius:6px;border:none;background:linear-gradient(180deg,#fff5f5,#ffffff);color:#c62828;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 140ms ease,box-shadow 140ms ease,background 140ms ease'
                    "
                    @mouseenter="
                      if (!$event.currentTarget.disabled) {
                        $event.currentTarget.style.transform = 'translateY(-2px)';
                        $event.currentTarget.style.boxShadow = '0 8px 24px rgba(198,40,40,0.12)';
                        $event.currentTarget.style.background =
                          'linear-gradient(180deg,#ffebee,#ffcdd2)';
                      }
                    "
                    @mouseleave="
                      if (!$event.currentTarget.disabled) {
                        $event.currentTarget.style.transform = '';
                        $event.currentTarget.style.boxShadow = '';
                        $event.currentTarget.style.background =
                          'linear-gradient(180deg,#fff5f5,#ffffff)';
                      }
                    "
                    @click.stop="remove_item(item)"
                    title="Delete item"
                  >
                    <i
                      class="mdi mdi-delete"
                      style="font-size: 18px; color: #b71c1c; line-height: 1; display: block"
                    ></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- =========================================== -->
    <!-- PAYMENT & FINANCIAL SUMMARY SECTION -->
    <!-- =========================================== -->
    <div
      style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        border-radius: 8px 8px 0 0;
        padding: 8px;
        border: 1px solid #e0e0e0;
        border-bottom: none;
        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.12);
        z-index: 100;
      "
    >
      <!-- FINANCIAL SUMMARY (Totals Row) -->
      <div
        style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 6px;
          margin-bottom: 3px;
          padding: 0px;
          background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
          border-radius: 4px;
        "
      >
        <!-- Total Qty Field -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #e0e0e0;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('Total Qty') }}</label
          >
          <div
            style="
              font-size: 0.9rem;
              font-weight: 700;
              color: #1976d2;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            "
          >
            {{ formatFloat(invoice_doc?.total_qty || 0) }}
          </div>
        </div>

        <!-- Additional Discount Field (Editable) -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #e0e0e0;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('Additional Discount') }}</label
          >
          <input
            type="number"
            :value="additional_discount_percentage"
            @input="onDiscountInput"
            @blur="onDiscountBlur"
            ref="percentage_discount"
            step="0.01"
            min="0"
            :max="pos_profile?.posa_invoice_max_discount_allowed || 100"
            style="
              width: 100%;
              border: none;
              outline: none;
              background: transparent;
              font-size: 0.9rem;
              font-weight: 700;
              color: #1976d2;
              padding: 0;
              text-align: left;
            "
            placeholder="0.00"
            :disabled="!pos_profile?.posa_allow_user_to_edit_additional_discount"
          />
        </div>

        <!-- Items Discount Field -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #ffcc02;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('items_dis') }}</label
          >
          <div
            style="
              font-size: 0.9rem;
              font-weight: 700;
              color: #f57c00;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            "
          >
            {{ currencySymbol(pos_profile?.currency)
            }}{{ formatCurrency(invoice_doc?.posa_item_discount_total || 0) }}
          </div>
        </div>

        <!-- Before Discount Field -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #e0e0e0;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('before_disc') }}</label
          >
          <div
            style="
              font-size: 0.9rem;
              font-weight: 700;
              color: #1976d2;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            "
          >
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(invoice_doc?.total || 0) }}
          </div>
        </div>

        <!-- Net Total Field -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #e0e0e0;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('net_total') }}</label
          >
          <div
            style="
              font-size: 0.9rem;
              font-weight: 700;
              color: #1976d2;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            "
          >
            {{ currencySymbol(pos_profile?.currency)
            }}{{ formatCurrency(invoice_doc?.net_total || 0) }}
          </div>
        </div>

        <!-- Tax Field -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #03a9f4;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('Tax') }}</label
          >
          <div
            style="
              font-size: 0.9rem;
              font-weight: 700;
              color: #0288d1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            "
          >
            {{ currencySymbol(pos_profile?.currency) }}{{ formatCurrency(computedTaxAmount) }}
          </div>
        </div>

        <!-- Grand Total Field -->
        <div
          style="
            display: flex;
            flex-direction: column;
            padding: 4px 6px;
            background: white;
            border-radius: 3px;
            border: 1px solid #2e7d32;
          "
        >
          <label
            style="
              font-size: 0.65rem;
              margin-bottom: 0;
              font-weight: 600;
              color: #2e7d32;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            "
            >{{ __('grand_total') }}</label
          >
          <div
            style="
              font-size: 0.9rem;
              font-weight: 800;
              color: #2e7d32;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            "
          >
            {{ currencySymbol(pos_profile?.currency)
            }}{{ formatCurrency(invoice_doc?.grand_total || 0) }}
          </div>
        </div>
      </div>

      <!-- =========================================== -->
      <!-- ACTION BUTTONS ROW -->
      <!-- =========================================== -->
      <div
        style="
          display: flex;
          gap: 1px;
          background: white;
          padding: 0px;
          border-radius: 6px;
          width: 100%;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
        "
      >
        <!-- Print Button -->
        <button
          :disabled="!hasItems"
          @click="printInvoice"
          :title="__('Print invoice')"
          style="
            flex: 1;
            padding: 8px 4px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.2s;
          "
          :style="
            !hasItems
              ? 'background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; opacity: 0.6'
              : ''
          "
          type="button"
        >
          <i class="mdi mdi-printer" style="font-size: 16px"></i>
          <span>{{ __('Print') }}</span>
        </button>

        <!-- Pay Button -->
        <button
          :disabled="!hasItems || is_payment || isUpdatingTotals"
          @click="show_payment"
          style="
            flex: 1;
            padding: 8px 4px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.2s;
          "
          :style="
            !hasItems || is_payment || isUpdatingTotals
              ? 'background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; opacity: 0.6'
              : ''
          "
          type="button"
        >
          <i class="mdi mdi-cash-multiple" style="font-size: 16px"></i>
          <span>{{ __('Pay') }}</span>
        </button>

        <!-- Return Button -->
        <button
          :disabled="!pos_profile?.posa_allow_return"
          @click="open_returns"
          style="
            flex: 1;
            padding: 8px 4px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: linear-gradient(135deg, #607d8b 0%, #455a64 100%);
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.2s;
          "
          :style="
            !pos_profile?.posa_allow_return
              ? 'background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; opacity: 0.6'
              : ''
          "
          type="button"
        >
          <i class="mdi mdi-keyboard-return" style="font-size: 16px"></i>
          <span>{{ __('Return') }}</span>
        </button>

        <!-- Quick Return Button -->
        <button
          :disabled="!pos_profile?.posa_allow_quick_return"
          @click="quick_return"
          style="
            flex: 1;
            padding: 8px 4px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.2s;
          "
          :style="
            !pos_profile?.posa_allow_quick_return
              ? 'background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; opacity: 0.6'
              : ''
          "
          type="button"
        >
          <i class="mdi mdi-flash" style="font-size: 16px"></i>
          <span>{{ __('Quick Return') }}</span>
        </button>

        <!-- Cancel Button -->
        <button
          @click="cancel_invoice"
          style="
            flex: 1;
            padding: 8px 4px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.2s;
          "
          type="button"
        >
          <i class="mdi mdi-close-circle" style="font-size: 16px"></i>
          <span>{{ __('Cancel') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script src="./Invoice.js" />
