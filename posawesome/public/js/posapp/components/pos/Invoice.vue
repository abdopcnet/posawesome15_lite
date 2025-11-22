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
      <div
        :style="
          quick_return_value
            ? {
                padding: '4px 6px',
                borderBottom: '1px solid #e0e0e0',
                marginBottom: '0',
                border: '3px solid #9c27b0',
                borderRadius: '8px',
                transition: 'border 0.3s ease',
              }
            : invoice_doc?.is_return
            ? {
                padding: '4px 6px',
                borderBottom: '1px solid #e0e0e0',
                marginBottom: '0',
                border: '3px solid #607d8b',
                borderRadius: '8px',
                transition: 'border 0.3s ease',
              }
            : {
                padding: '4px 6px',
                borderBottom: '1px solid #e0e0e0',
                marginBottom: '0',
                border: '3px solid #4caf50',
                borderRadius: '8px',
                transition: 'border 0.3s ease',
              }
        "
      >
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
            /* min-width: 600px; */
            /* max-width: 100%; */
            width: 100%;
            border-collapse: collapse;
            background: white;
            font-size: 0.75rem;
            table-layout: auto; /* let browser size columns by content */
            white-space: nowrap; /* prevent wrapping across the table - cells will ellipsize */
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
                  padding: 8px 2px;
                  font-weight: 600;
                  font-size: 0.75rem;
                  color: #424242;
                  position: sticky;
                  top: 0;
                  z-index: 1;
                  text-align: center;
                  white-space: nowrap; /* ensure header text doesn't wrap */
                  overflow: hidden; /* truncate if needed */
                  text-overflow: ellipsis; /* show ellipsis */
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
                $event.currentTarget.style.background = 'rgba(16,24,40,0.09)';
                $event.currentTarget.style.transition =
                  'background-color 160ms ease';
              "
              @mouseleave="
                $event.currentTarget.style.background = '';
                $event.currentTarget.style.transition =
                  'background-color 160ms ease';
              "
              :style="{
                borderBottom: '1px solid #f1f1f1',
                borderLeft:
                  item.discount_percentage > 0 || item.posa_offer_applied
                    ? '3px solid #ff9800'
                    : 'none',
              }"
            >
              <!-- ITEM NAME COLUMN -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'item_name')"
                style="
                  padding: 12px 0px 12px 3px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                "
              >
                <!-- <div style="width: 120px"> -->
                <p
                  style="
                    margin-bottom: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-size: 0.7rem !important;
                  "
                  :title="item.item_name"
                >
                  {{ item.item_name }}
                </p>
                <!-- </div> -->
              </td>

              <!-- QUANTITY COLUMN -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'qty')"
                style="
                  /* padding: 6px;  */
                  padding: 12px 0px;
                  vertical-align: middle;
                  max-width: 80px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    /* gap: 2px;
                    padding: 2px; */
                    gap: 0px;
                    padding: 0px;
                    background: linear-gradient(
                      135deg,
                      #f8f9fa 0%,
                      #ffffff 100%
                    );
                    border-radius: 4px;
                    width: 100%;
                    /* max-width: 85px; */
                    min-width: 0; /* allow shrinking inside cell */
                    box-sizing: border-box;
                    overflow: hidden;
                  "
                >
                  <button
                    style="
                      flex-shrink: 0;
                      width: 16px;
                      height: 16px;
                      min-width: 16px;
                      padding: 0;
                      border: none;
                      border-radius: 3px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 0;
                      position: relative;
                      color: white;
                      background: linear-gradient(
                        135deg,
                        #ff9800 0%,
                        #f57c00 100%
                      );
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    "
                    @click="decreaseQuantity(item)"
                    :disabled="!(item.qty && Math.abs(item.qty) > 0)"
                    type="button"
                  >
                    <span
                      style="
                        /* font-size: 0.85rem; */
                        font-size: 0.75rem;
                        font-weight: 700;
                        line-height: 1;
                      "
                      >−</span
                    >
                  </button>

                  <input
                    type="text"
                    :value="Math.abs(item.qty || 0)"
                    @input="onQtyInput(item, $event)"
                    @change="onQtyChange(item, $event)"
                    @blur="handleQtyBlur(item, $event)"
                    style="
                      flex: 1;
                      width: 100%;
                      min-width: 0;
                      border: 1px solid #1976d2;
                      background: white;
                      text-align: center;
                      font-size: 0.75rem;
                      margin: 0px 1px;
                      padding: 0px 0px;
                      border-radius: 3px;
                      outline: none;
                      box-sizing: border-box;
                      max-width: 100%;
                      min-width: 10px !important;
                    "
                    placeholder="0"
                  />
                  <button
                    style="
                      flex-shrink: 0;
                      width: 16px;
                      height: 16px;
                      min-width: 16px;
                      padding: 0;
                      border: none;
                      border-radius: 3px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 0;
                      position: relative;
                      color: white;
                      background: linear-gradient(
                        135deg,
                        #4caf50 0%,
                        #388e3c 100%
                      );
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    "
                    @click="increaseQuantity(item)"
                    type="button"
                  >
                    <span
                      style="
                        /* font-size: 0.85rem; */
                        font-size: 0.75rem;
                        font-weight: 700;
                        line-height: 1;
                      "
                      >+</span
                    >
                  </button>
                </div>
              </td>

              <!-- UOM COLUMN -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'uom')"
                style="
                  padding: 12px 0px;
                  vertical-align: middle;
                  text-align: center;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                "
              >
                {{ item.uom }}
              </td>

              <!-- PRICE LIST RATE COLUMN (Original Price) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'price_list_rate')"
                style="
                  padding: 12px 0px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                  max-width: 80px;
                "
              >
                <div
                  :style="{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '0px 3px',
                    background: item._offer_discount_applied
                      ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                      : 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                    borderRadius: '4px',
                    minWidth: 0,
                    justifyContent: 'center',
                    placeSelf: 'center',
                    overflow: 'hidden',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      color: item._offer_discount_applied
                        ? '#e65100'
                        : '#2e7d32',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }"
                  >
                    {{ formatCurrency(item.price_list_rate) }}
                  </span>
                </div>
              </td>

              <!-- RATE COLUMN (Discounted Price - Editable) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'rate')"
                style="
                  padding: 12px 0px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                  max-width: 75px;
                  justify-items: center;
                "
              >
                <div
                  :style="{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '0px 3px',
                    background:
                      flt(item.rate) !== flt(item.price_list_rate)
                        ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                        : 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                    borderRadius: '4px',
                    minWidth: '0',
                    maxWidth: '65px',
                    justifyContent: 'center',
                    position: 'relative',
                    border:
                      flt(item.rate) !== flt(item.price_list_rate)
                        ? '1px solid #ff9800'
                        : 'none',
                  }"
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
                          invoice_doc?.is_return
                      )
                    "
                    :style="
                      Boolean(
                        item.posa_is_offer ||
                          item.posa_is_replace ||
                          item.posa_offer_applied ||
                          invoice_doc?.is_return
                      )
                        ? 'flex: 1; width: 100%; border: none;background: #f5f5f5; color: #9e9e9e; font-size: 0.7rem; padding: 2px 2px; border-radius: 3px; outline: none; cursor: not-allowed; max-width: 45px;'
                        : 'flex: 1; width: 100%; border: none; background: transparent; font-size: 0.75rem; font-weight: 700; color: #f57c00; padding: 0; outline: none; text-align: right; max-width: 45px;'
                    "
                    placeholder="0.00"
                    style="
                      box-sizing: border-box;
                      min-width: 0;
                      max-width: 100%;
                    "
                  />

                  <!-- Discount indicator for rate -->
                  <!-- <span
                    v-if="
                      flt(item.rate) !== flt(item.price_list_rate) &&
                      flt(item.rate) < flt(item.price_list_rate)
                    "
                    style="
                      position: absolute;
                      top: -2px;
                      right: -2px;
                      background: #ff9800;
                      color: white;
                      font-size: 0.5rem;
                      font-weight: 600;
                      padding: 1px 3px;
                      border-radius: 2px;
                      line-height: 1;
                    "
                  >
                    DISCOUNT
                  </span> -->
                </div>
              </td>

              <!-- DISCOUNT PERCENTAGE COLUMN (Editable) -->
              <td
                v-if="
                  dynamicHeaders.find((h) => h.key === 'discount_percentage')
                "
                style="
                  padding: 12px 0px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                  max-width: 85px;
                "
              >
                <div
                  :style="{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '0px 6px',
                    background:
                      item.discount_percentage > 0
                        ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                        : 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                    borderRadius: '4px',
                    minWidth: '0',
                    justifyContent: 'center',
                    position: 'relative',
                  }"
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
                          invoice_doc?.is_return
                      )
                    "
                    :style="
                      Boolean(
                        item.posa_is_offer ||
                          item.posa_is_replace ||
                          item.posa_offer_applied ||
                          !pos_profile?.posa_allow_user_to_edit_item_discount ||
                          invoice_doc?.is_return
                      )
                        ? 'flex: 1; width: 100%; border: none; background: #f5f5f5; color: #9e9e9e; font-size: 0.75rem; padding: 2px 4px; border-radius: 3px; outline: none; cursor: not-allowed; text-align: right'
                        : 'flex: 1; width: 100%; border: none; background: transparent; font-size: 0.75rem; font-weight: 700; color: #f57c00; padding: 0; outline: none; text-align: right'
                    "
                    placeholder="0"
                    min="0"
                    :max="pos_profile?.posa_item_max_discount_allowed || 100"
                    step="0.01"
                    style="
                      box-sizing: border-box;
                      min-width: 0;
                      max-width: 100%;
                    "
                  />

                  <span
                    style="
                      font-size: 0.65rem;
                      font-weight: 700;
                      color: #f57c00;
                      white-space: nowrap;
                      flex-shrink: 0;
                    "
                    >%</span
                  >

                  <!-- Offer badge for discount percentage -->
                  <span
                    v-if="
                      item.posa_offer_applied && item.discount_percentage > 0
                    "
                    style="
                      position: absolute;
                      top: -2px;
                      right: -2px;
                      background: #4caf50;
                      color: white;
                      font-size: 0.5rem;
                      font-weight: 600;
                      padding: 1px 3px;
                      border-radius: 2px;
                      line-height: 1;
                    "
                  >
                    OFFER
                  </span>
                </div>
              </td>

              <!-- DISCOUNT AMOUNT COLUMN (Calculated) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'discount_amount')"
                style="
                  padding: 12px 1px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                  max-width: 80px;
                  justify-items: center;
                "
              >
                <div
                  :style="{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '0px 2px',
                    background:
                      getDiscountAmount(item) > 0
                        ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                        : 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)',
                    borderRadius: '4px',
                    minWidth: '0',
                    maxWidth: '85px',
                    justifyContent: 'center',
                    position: 'relative',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      color:
                        getDiscountAmount(item) > 0 ? '#f57c00' : '#9e9e9e',
                    }"
                  >
                    {{ formatCurrency(getDiscountAmount(item)) }}
                  </span>
                  <!-- Offer badge for discount amount -->
                  <span
                    v-if="
                      item.posa_offer_applied && getDiscountAmount(item) > 0
                    "
                    style="
                      position: absolute;
                      top: -2px;
                      right: -2px;
                      background: #4caf50;
                      color: white;
                      font-size: 0.5rem;
                      font-weight: 600;
                      padding: 1px 2px;
                      border-radius: 2px;
                      line-height: 1;
                    "
                  >
                    OFFER
                  </span>
                </div>
              </td>

              <!-- TOTAL AMOUNT COLUMN (Calculated: Qty × Rate) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'amount')"
                style="
                  padding: 12px 0px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                "
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    padding: 0px 6px;
                    background: linear-gradient(
                      135deg,
                      #e8f5e9 0%,
                      #c8e6c9 100%
                    );
                    border-radius: 4px;
                    min-width: 0;
                    justify-content: center;
                    overflow: hidden;
                  "
                >
                  <span
                    style="
                      font-size: 0.75rem;
                      font-weight: 700;
                      color: #1b5e20;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    "
                  >
                    {{
                      formatCurrency(
                        flt(item.qty, float_precision) *
                          flt(item.rate, currency_precision)
                      )
                    }}
                  </span>
                </div>
              </td>

              <!-- ACTIONS COLUMN (Delete Button) -->
              <td
                v-if="dynamicHeaders.find((h) => h.key === 'actions')"
                style="
                  padding: 12px 0px;
                  vertical-align: middle;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 0;
                "
              >
                <div
                  style="
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  "
                >
                  <button
                    :disabled="
                      Boolean(item.posa_is_offer || item.posa_is_replace)
                    "
                    :style="
                      item.posa_is_offer || item.posa_is_replace
                        ? 'width:18px;height:18px;padding:0;border-radius:6px;border:none;background:#f3f3f3;color:#9e9e9e;display:flex;align-items:center;justify-content:center;cursor:not-allowed;opacity:0.6;transition:transform 140ms ease,box-shadow 140ms ease,background 140ms ease'
                        : 'width:18px;height:18px;padding:0;border-radius:6px;border:none;background:linear-gradient(180deg,#fff5f5,#ffffff);color:#c62828;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 140ms ease,box-shadow 140ms ease,background 140ms ease'
                    "
                    @mouseenter="
                      if (!$event.currentTarget.disabled) {
                        $event.currentTarget.style.transform =
                          'translateY(-2px)';
                        $event.currentTarget.style.boxShadow =
                          '0 10px 30px rgba(198,40,40,0.12)';
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
                    title="حذف الصنف"
                  >
                    <i
                      class="mdi mdi-delete"
                      style="
                        font-size: 18px;
                        color: #b71c1c;
                        line-height: 1;
                        display: block;
                        pointer-events: none;
                      "
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
        background: #c4763d85;
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
        <!-- Total_Qty Field -->
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
            ><!-- Total_Qty -->
            إجمالي الكمية</label
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

        <!-- Invoice_discount Field (Editable) -->
        <div
          :style="{
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 6px',
            background: pos_profile?.posa_allow_user_to_edit_additional_discount
              ? 'white'
              : '#f5f5f5',
            borderRadius: '3px',
            border: pos_profile?.posa_allow_user_to_edit_additional_discount
              ? '1px solid #e0e0e0'
              : '1px solid #d0d0d0',
            position: 'relative',
          }"
        >
          <label
            :style="{
              fontSize: '0.65rem',
              marginBottom: '0',
              fontWeight: '600',
              color: pos_profile?.posa_allow_user_to_edit_additional_discount
                ? '#666'
                : '#9e9e9e',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }"
            ><!-- Invoice_discount -->
            خصم الفاتورة</label
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
            :style="{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              fontWeight: '700',
              color: pos_profile?.posa_allow_user_to_edit_additional_discount
                ? '#1976d2'
                : '#9e9e9e',
              padding: '0',
              textAlign: 'left',
              cursor: pos_profile?.posa_allow_user_to_edit_additional_discount
                ? 'text'
                : 'not-allowed',
            }"
            placeholder="0.00"
            :disabled="
              !pos_profile?.posa_allow_user_to_edit_additional_discount
            "
          />
          <!-- Offer badge for Invoice_discount -->
          <span
            v-if="
              offer_discount_percentage > 0 &&
              additional_discount_percentage > 0
            "
            style="
              position: absolute;
              top: -2px;
              right: -2px;
              background: #4caf50;
              color: white;
              font-size: 0.5rem;
              font-weight: 600;
              padding: 1px 3px;
              border-radius: 2px;
              line-height: 1;
            "
          >
            OFFER
          </span>
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
            ><!-- items_discount -->
            خصم الأصناف</label
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
            ><!-- list_price_total -->
            الإجمالي قبل الخصم</label
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
            }}{{ formatCurrency(invoice_doc?.total || 0) }}
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
            ><!-- net_total -->
            الصافي</label
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
            ><!-- Tax -->
            الضريبة</label
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
            {{ currencySymbol(pos_profile?.currency)
            }}{{ formatCurrency(computedTaxAmount) }}
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
            ><!-- grand_total -->
            الإجمالي الكلي</label
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
          v-if="!hasExcessNonCashPayment"
          :disabled="!hasItems || isPrinting || !hasValidPayments()"
          @click="printInvoice"
          title="طباعة الفاتورة"
          style="
            flex: 1;
            padding: 8px 4px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
            color: white;
            font-size: 0.85rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.2s;
          "
          :style="
            !hasItems || isPrinting || !hasValidPayments()
              ? 'background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; opacity: 0.6'
              : ''
          "
          type="button"
        >
          <i class="mdi mdi-printer" style="font-size: 16px"></i>
          <!-- Printing / Print -->
          <span style="font-size: 0.85rem;">{{ isPrinting ? "جاري الطباعة..." : "طباعة" }}</span>
        </button>

        <!-- Warning Message for Excess Non-Cash Payment -->
        <div
          v-if="hasExcessNonCashPayment"
          style="
            flex: 1;
            padding: 8px 4px;
            border-radius: 5px;
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
            color: white;
            font-size: 0.85rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            text-align: center;
          "
        >
          <i class="mdi mdi-alert" style="font-size: 16px"></i>
          <span style="font-size: 0.85rem;">المبلغ الزائد غير مسموح</span>
        </div>

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
            font-size: 0.85rem;
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
          <!-- Pay -->
          <span style="font-size: 0.85rem;">دفع</span>
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
            background: #607d8b;
            color: white;
            font-size: 0.85rem;
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
          <!-- Return_invoice -->
          <span style="font-size: 0.85rem;">مرتجع فاتورة</span>
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
            font-size: 0.85rem;
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
          <!-- Quick_Return -->
          <span style="font-size: 0.85rem;">مرتجع سريع</span>
        </button>

        <!-- Smart Draft Button: تكملة فاتورة / حفظ الفاتورة -->
        <button
          @click="handleDraftButton"
          :style="
            hasItems
              ? {
                  flex: 1,
                  padding: '8px 4px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                }
              : {
                  flex: 1,
                  padding: '8px 4px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                }
          "
          type="button"
        >
          <i :class="hasItems ? 'mdi mdi-content-save' : 'mdi mdi-file-document-edit'" style="font-size: 16px"></i>
          <span style="font-size: 0.85rem;">{{ hasItems ? "حفظ الفاتورة" : "تكملة فاتورة" }}</span>
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
            font-size: 0.85rem;
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
          <!-- Cancel -->
          <span style="font-size: 0.85rem;">إلغاء</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script src="./Invoice.js" />
