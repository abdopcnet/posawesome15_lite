<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- COMPACT PAYMENTS COMPONENT -->
  <!-- =========================================== -->
  <div style="
  width: 100%;
  height: 100%;
    position: relative">
    
    <!-- Fixed Back Button -->
    <button style="
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(25, 118, 210, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.3px;
      white-space: nowrap;
      line-height: 1"
      @click="back_to_invoice" 
      :title="__('Back to Invoice')">
      <i class="mdi mdi-arrow-left" style="color: white; font-size: 18px"></i>
      <span>{{ __("Back") }}</span>
    </button>

    <div style="
      max-height: 76vh; 
      height: 76vh;
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      position: relative">
      
      <!-- Loading Progress -->
      <div v-if="loading" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: #e0e0e0;
        overflow: hidden;
        z-index: 10">
        <div style="
          height: 100%;
          background: #1976d2;
          animation: progress-indeterminate 1.5s infinite linear;
          transform-origin: 0% 50%"></div>
      </div>

      <div style="max-height: 75vh; overflow-y: auto; overflow-x: hidden; padding: 6px">
        
        <!-- =========================================== -->
        <!-- PAYMENT SUMMARY SECTION -->
        <!-- =========================================== -->
        <div v-if="invoice_doc" style="
  display: flex;
          flex-direction: column;
  gap: 3px;
          margin-bottom: 2px">
          
          <!-- Summary Row 1 -->
          <div style="display: flex; gap: 3px; align-items: flex-start">
            
            <!-- Total Paid -->
            <div style="flex: 1.4; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Total Paid") }}
              </label>
              <div style="
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  border-radius: 3px;
                border: 1px solid #4caf50;
                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  min-height: 22px;
                transition: all 0.2s ease">
                <span style="
  font-size: 0.6rem;
  font-weight: 600;
  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
  font-size: 0.7rem;
  font-weight: 700;
                  color: #2e7d32;
  flex: 1;
                  text-align: right">
                  {{ formatCurrency(total_payments) }}
                </span>
              </div>
            </div>
            
            <!-- Remaining -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Remaining") }}
              </label>
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 3px 6px;
                border-radius: 3px;
                border: 1px solid #ff9800;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                min-height: 22px;
                transition: all 0.2s ease">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
                  font-size: 0.7rem;
                  font-weight: 700;
  color: #e65100;
                  flex: 1;
                  text-align: right">
                  {{ formatCurrency(diff_payment) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Summary Row 2 (Change Amount) -->
          <div v-if="diff_payment < 0 && !invoice_doc.is_return" style="display: flex; gap: 3px; align-items: flex-start">
            
            <!-- Remaining Amount -->
            <div style="flex: 1.4; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Remaining Amount") }}
              </label>
              <div style="
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #1976d2;
  border-radius: 3px;
  padding: 1px 4px;
  min-height: 22px;
                transition: all 0.2s ease">
                <span style="
  font-size: 0.6rem;
  font-weight: 600;
  color: #1976d2;
  margin-right: 3px;
                  flex-shrink: 0">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <input 
                  type="number" 
                  v-model="paid_change"
                  @input="set_paid_change()" 
                  readonly
                  style="
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.7rem;
  font-weight: 700;
                    color: #757575;
  text-align: right;
  padding: 1px;
  min-width: 0;
  line-height: 1.2;
                    cursor: not-allowed" />
              </div>
            </div>
            
            <!-- Change Amount -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
  margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Change Amount") }}
              </label>
              <div style="
  display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 3px 6px;
                border-radius: 3px;
                border: 1px solid #2196f3;
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                min-height: 22px;
                transition: all 0.2s ease">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
                  font-size: 0.7rem;
                  font-weight: 700;
                  color: #0d47a1;
                  flex: 1;
                  text-align: right">
                  {{ formatCurrency(credit_change) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Divider -->
        <div style="
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
          margin: 4px 0"></div>

        <!-- =========================================== -->
        <!-- PAYMENT METHODS SECTION -->
        <!-- =========================================== -->
        <div v-if="is_cashback" style="
  display: flex;
  flex-direction: column;
  gap: 3px;
          margin: 2px 0">
          
          <div v-for="payment in invoice_doc.payments" :key="payment.name" style="
  display: flex;
  gap: 3px;
            align-items: flex-end">
            
            <!-- Amount Input -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Amount") }}
              </label>
              <div style="
  display: flex;
                align-items: center;
                background: white;
                border: 1px solid #1976d2;
                border-radius: 3px;
                padding: 1px 4px;
                min-height: 22px;
                transition: all 0.2s ease">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #1976d2;
                  margin-right: 3px;
                  flex-shrink: 0">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <input 
                  type="text" 
                  :value="formatCurrency(payment.amount)"
                  @change="setFormatedCurrency(payment, 'amount', null, true, $event)"
                  @focus="set_rest_amount(payment.idx)" 
                  :readonly="invoice_doc.is_return ? true : false"
                  placeholder="0.00"
                  style="
  flex: 1;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #1976d2;
                    text-align: right;
                    padding: 1px;
                    min-width: 0;
                    line-height: 1.2" />
              </div>
            </div>
            
            <!-- Payment Method Button -->
            <button 
              :style="payment.type == 'Phone' && payment.amount > 0 && request_payment_field ? 'flex: 0.7;' : 'flex: 1;'"
              style="
  height: 22px;
  border: none;
  border-radius: 3px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(25, 118, 210, 0.25);
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
                padding: 0 4px"
              @click="set_full_amount(payment.idx)">
              {{ payment.mode_of_payment }}
            </button>
            
            <!-- Request Button (for Phone) -->
            <button 
              v-if="payment.type == 'Phone' && payment.amount > 0 && request_payment_field"
              :disabled="payment.amount == 0"
              @click="(phone_dialog = true), (payment.amount = flt(payment.amount, 0))"
              style="
  flex: 0.4;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(76, 175, 80, 0.25);
                transition: all 0.2s ease"
              :style="payment.amount == 0 ? 'background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%); color: #9e9e9e; cursor: not-allowed; opacity: 0.6' : ''">
              {{ __("Request") }}
            </button>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- LOYALTY POINTS SECTION -->
        <!-- =========================================== -->
        <div v-if="invoice_doc && available_pioints_amount > 0 && !invoice_doc.is_return" style="margin: 3px 0">
          <div style="display: flex; gap: 3px; align-items: flex-start">
            
            <!-- Pay from Customer Points -->
            <div style="flex: 1.4; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Pay from Customer Points") }}
              </label>
              <div style="
  display: flex;
                align-items: center;
                background: white;
                border: 1px solid #1976d2;
                border-radius: 3px;
                padding: 1px 4px;
                min-height: 22px;
                transition: all 0.2s ease">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #1976d2;
                  margin-right: 3px;
                  flex-shrink: 0">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <input 
                  type="number" 
                  v-model="loyalty_amount" 
                  placeholder="0.00"
                  style="
                    flex: 1;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #1976d2;
                    text-align: right;
                    padding: 1px;
                    min-width: 0;
                    line-height: 1.2" />
              </div>
            </div>
            
            <!-- Customer Points Balance -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
  font-size: 0.6rem;
  font-weight: 600;
                color: #666;
  text-transform: uppercase;
  letter-spacing: 0.3px;
                margin: 0;
  padding: 0 2px;
                line-height: 1">
                {{ __("Customer Points Balance") }}
              </label>
              <div style="
  display: flex;
  align-items: center;
                justify-content: space-between;
                padding: 3px 6px;
                border-radius: 3px;
                border: 1px solid #bdbdbd;
                background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                min-height: 22px;
                transition: all 0.2s ease;
                opacity: 0.8">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
  font-size: 0.7rem;
                  font-weight: 700;
                  color: #757575;
                  flex: 1;
                  text-align: right">
                  {{ formatFloat(available_pioints_amount) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- CUSTOMER CREDIT SECTION -->
        <!-- =========================================== -->
        <div v-if="invoice_doc && available_customer_credit > 0 && !invoice_doc.is_return && redeem_customer_credit" style="margin: 3px 0">
          <div style="display: flex; gap: 3px; align-items: flex-start">
            
            <!-- Customer Credit Redeemed -->
            <div style="flex: 1.4; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
  font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Customer Credit Redeemed") }}
              </label>
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
  padding: 3px 6px;
  border-radius: 3px;
                border: 1px solid #bdbdbd;
                background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                min-height: 22px;
                transition: all 0.2s ease;
                opacity: 0.8">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
                  font-size: 0.7rem;
                  font-weight: 700;
                  color: #757575;
  flex: 1;
                  text-align: right">
                  {{ formatCurrency(redeemed_customer_credit) }}
                </span>
              </div>
            </div>
            
            <!-- Cash Credit Balance -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                margin: 0;
                padding: 0 2px;
                line-height: 1">
                {{ __("Cash Credit Balance") }}
              </label>
              <div style="
  display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 3px 6px;
                border-radius: 3px;
                border: 1px solid #bdbdbd;
                background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                min-height: 22px;
                transition: all 0.2s ease;
                opacity: 0.8">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
                  font-size: 0.7rem;
                  font-weight: 700;
                  color: #757575;
    flex: 1;
                  text-align: right">
                  {{ formatCurrency(available_customer_credit) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Divider -->
        <div style="
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
          margin: 4px 0"></div>

        <!-- =========================================== -->
        <!-- OPTIONS SECTION (SWITCHES) -->
        <!-- =========================================== -->
        <div style="
  display: flex;
  gap: 4px;
          margin: 3px 0;
          padding: 4px;
          background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%);
          border-radius: 4px;
          flex-wrap: wrap">
          
          <!-- Write Off Amount Switch -->
          <div v-if="pos_profile.posa_allow_write_off_change && diff_payment > 0 && !invoice_doc.is_return" 
               style="flex: 1 1 calc(50% - 2px); min-width: 130px">
            <label style="
              display: flex;
              align-items: center;
              cursor: pointer;
              user-select: none;
              gap: 12px">
              <input type="checkbox" v-model="is_write_off_change" style="
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0" />
              <span style="
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                background: #ccc;
                border-radius: 24px;
                transition: all 0.3s ease;
                flex-shrink: 0">
                <span style="
                  content: '';
                  position: absolute;
                  height: 18px;
                  width: 18px;
                  left: 3px;
                  bottom: 3px;
                  background: white;
                  border-radius: 50%;
                  transition: all 0.3s ease;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2)"
                  :style="is_write_off_change ? 'transform: translateX(20px); background: white' : ''"></span>
                <span v-if="is_write_off_change" style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: #1976d2;
                  border-radius: 24px;
                  pointer-events: none"></span>
              </span>
              <span style="
  font-size: 0.85rem;
  color: #333;
                font-weight: 500">
                {{ __("Is Write Off Amount?") }}
              </span>
            </label>
          </div>

          <!-- Credit Sale Switch -->
          <div v-if="pos_profile.posa_allow_credit_sale && !invoice_doc.is_return" 
               style="flex: 1 1 calc(50% - 2px); min-width: 130px">
            <label style="
              display: flex;
              align-items: center;
  cursor: pointer;
              user-select: none;
              gap: 12px">
              <input type="checkbox" v-model="is_credit_sale" style="
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0" />
              <span style="
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                background: #ccc;
                border-radius: 24px;
                transition: all 0.3s ease;
                flex-shrink: 0">
                <span style="
                  content: '';
                  position: absolute;
                  height: 18px;
                  width: 18px;
                  left: 3px;
                  bottom: 3px;
  background: white;
                  border-radius: 50%;
                  transition: all 0.3s ease;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2)"
                  :style="is_credit_sale ? 'transform: translateX(20px); background: white' : ''"></span>
                <span v-if="is_credit_sale" style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: #1976d2;
                  border-radius: 24px;
                  pointer-events: none"></span>
              </span>
              <span style="
                font-size: 0.85rem;
                color: #333;
                font-weight: 500">
                {{ __("Is Credit Sale?") }}
              </span>
            </label>
          </div>

          <!-- Use Customer Credit Switch -->
          <div v-if="!invoice_doc.is_return && pos_profile.posa_use_customer_credit" 
               style="flex: 1 1 calc(50% - 2px); min-width: 130px">
            <label style="
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
              gap: 12px">
              <input 
                type="checkbox" 
                v-model="redeem_customer_credit"
                @change="get_available_credit($event.target.checked)"
                style="
  position: absolute;
  opacity: 0;
  width: 0;
                  height: 0" />
              <span style="
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background: #ccc;
  border-radius: 24px;
  transition: all 0.3s ease;
                flex-shrink: 0">
                <span style="
                  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s ease;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2)"
                  :style="redeem_customer_credit ? 'transform: translateX(20px); background: white' : ''"></span>
                <span v-if="redeem_customer_credit" style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
  background: #1976d2;
                  border-radius: 24px;
                  pointer-events: none"></span>
              </span>
              <span style="
  font-size: 0.85rem;
  color: #333;
                font-weight: 500">
                {{ __("Use Customer Credit") }}
              </span>
            </label>
          </div>

          <!-- Cash Return Switch -->
          <div v-if="invoice_doc.is_return && pos_profile.posa_use_cashback" 
               style="flex: 1 1 calc(50% - 2px); min-width: 130px">
            <label style="
              display: flex;
              align-items: center;
              cursor: pointer;
              user-select: none;
              gap: 12px">
              <input type="checkbox" v-model="is_cashback" style="
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0" />
              <span style="
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                background: #ccc;
                border-radius: 24px;
                transition: all 0.3s ease;
                flex-shrink: 0">
                <span style="
                  content: '';
                  position: absolute;
                  height: 18px;
                  width: 18px;
                  left: 3px;
                  bottom: 3px;
                  background: white;
                  border-radius: 50%;
                  transition: all 0.3s ease;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2)"
                  :style="is_cashback ? 'transform: translateX(20px); background: white' : ''"></span>
                <span v-if="is_cashback" style="
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
                  bottom: 0;
  background: #1976d2;
                  border-radius: 24px;
                  pointer-events: none"></span>
              </span>
              <span style="
                font-size: 0.85rem;
                color: #333;
                font-weight: 500">
                {{ __("Is Cash Return?") }}
              </span>
            </label>
          </div>

          <!-- Due Date Field -->
          <div v-if="is_credit_sale" style="flex: 1 1 calc(50% - 2px); min-width: 130px; display: flex; flex-direction: column; gap: 2px">
            <label style="
              font-size: 0.6rem;
              font-weight: 600;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin: 0;
              padding: 0 2px;
              line-height: 1">
              {{ __("Due Date") }}
            </label>
            <div style="
              display: flex;
              flex-direction: column;
              gap: 4px;
              width: 100%">
              <input 
                type="date" 
                v-model="invoice_doc.due_date"
                :min="frappe.datetime.now_date()" 
                placeholder="Select date"
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
                  cursor: pointer" />
            </div>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- CREDIT DETAILS SECTION -->
        <!-- =========================================== -->
        <div v-if="invoice_doc && available_customer_credit > 0 && !invoice_doc.is_return && redeem_customer_credit" style="
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin: 3px 0;
          padding: 4px;
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
          border-radius: 4px;
          border: 1px solid #ff9800">
          
          <div v-for="(row, idx) in customer_credit_dict" :key="idx" style="
            display: flex;
            gap: 3px;
            align-items: center">
            
            <!-- Credit Origin -->
            <div style="
              flex: 0.8;
              font-size: 0.7rem;
              font-weight: 600;
              color: #e65100;
              padding: 3px 6px;
              background: white;
              border-radius: 3px;
              border: 1px solid #ffcc80;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis">
              {{ row.credit_origin }}
            </div>

            <!-- Available Credit -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #e65100;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                padding: 0 2px;
                line-height: 1">
                {{ __("Available Credit") }}
              </label>
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 3px 6px;
                border-radius: 3px;
                border: 1px solid #bdbdbd;
                background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                min-height: 22px;
                transition: all 0.2s ease;
                opacity: 0.8">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #666;
                  margin-right: 3px">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <span style="
                  font-size: 0.7rem;
                  font-weight: 700;
                  color: #757575;
                  flex: 1;
                  text-align: right">
                  {{ formatCurrency(row.total_credit) }}
                </span>
              </div>
            </div>

            <!-- Credit to Redeem -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
              <label style="
                font-size: 0.6rem;
                font-weight: 600;
                color: #e65100;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                padding: 0 2px;
                line-height: 1">
                Credit to Redeem
              </label>
              <div style="
                display: flex;
                align-items: center;
                background: white;
                border: 1px solid #1976d2;
                border-radius: 3px;
                padding: 1px 4px;
                min-height: 22px;
                transition: all 0.2s ease">
                <span style="
                  font-size: 0.6rem;
                  font-weight: 600;
                  color: #1976d2;
                  margin-right: 3px;
                  flex-shrink: 0">
                  {{ currencySymbol(invoice_doc.currency) }}
                </span>
                <input 
                  type="number" 
                  v-model="row.credit_to_redeem" 
                  placeholder="0.00"
                  style="
                    flex: 1;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #1976d2;
                    text-align: right;
                    padding: 1px;
                    min-width: 0;
                    line-height: 1.2" />
              </div>
            </div>
          </div>
        </div>

        <!-- Section Divider -->
        <div style="
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
          margin: 4px 0"></div>
      </div>
    </div>

    <!-- =========================================== -->
    <!-- PHONE DIALOG -->
    <!-- =========================================== -->
    <div v-if="phone_dialog" style="
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
      z-index: 1000"
      @click="phone_dialog = false">

      <div style="
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
        overflow: hidden"
        @click.stop>
        
        <div style="
          background: white;
          border-radius: 12px;
  overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1)">
          
          <!-- Card Header -->
          <div style="
            padding: 16px;
            border-bottom: 1px solid #e0e0e0;
            background: #f5f5f5;
            position: relative">
            <span style="
              font-size: 1.5rem;
              font-weight: 700;
              color: #1976d2">
              Confirm Phone Number
            </span>
            <button 
              @click="phone_dialog = false"
              style="
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
                transition: all 0.2s ease">×</button>
          </div>
          
          <!-- Card Body -->
          <div style="padding: 16px">
            <div style="padding: 0">
              <div style="
                display: flex;
                flex-direction: column;
                gap: 4px;
                width: 100%">
                <label style="
                  font-size: 0.75rem;
                  font-weight: 600;
                  color: #555;
                  margin-bottom: 2px">
                  Phone Number
                </label>
                <input 
                  type="number" 
                  v-model="invoice_doc.contact_mobile"
                  placeholder="Enter phone number"
                  style="
                    width: 100%;
                    padding: 8px 12px;
                    font-size: 0.85rem;
  color: #333;
                    background: white;
                    border: 1px solid #d0d0d0;
                    border-radius: 6px;
                    outline: none;
                    transition: all 0.2s ease" />
              </div>
            </div>
          </div>
          
          <!-- Card Footer -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding: 16px;
            border-top: 1px solid #e0e0e0">
            <div style="flex: 1"></div>
            <button 
              @click="phone_dialog = false"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid #d32f2f;
                transition: all 0.2s;
                line-height: 1.5;
                margin: 0 4px;
                background: linear-gradient(135deg, #f44336 0%, #e53935 100%);
                color: white">Close</button>
            <button 
              @click="request_payment"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid #1565c0;
                transition: all 0.2s;
                line-height: 1.5;
                margin: 0 4px;
                background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
                color: white">Request</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./Payments.js" />
