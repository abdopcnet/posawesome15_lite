<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- UPDATE CUSTOMER DIALOG -->
  <!-- =========================================== -->
  <div style="display: flex; justify-content: center; align-items: center">
    <!-- Modal Overlay -->
    <div
      v-if="customerDialog"
      @click="clear_customer"
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
          max-width: 400px;
          width: 90%;
          max-height: 90vh;
          overflow: hidden;
          animation: modal-slide-in 0.3s ease;
        "
      >
        <!-- Modal Content -->
        <div
          style="
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          "
        >
          <!-- =========================================== -->
          <!-- MODAL HEADER -->
          <!-- =========================================== -->
          <div
            style="
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 6px 10px;
              background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
              color: white;
            "
          >
            <i
              class="mdi mdi-account-circle"
              style="
                color: white;
                font-size: 20px;
                filter: drop-shadow(0 6px 16px rgba(33, 150, 243, 0.1));
              "
            ></i>
            <span style="flex: 1; font-size: 13px; font-weight: 600; letter-spacing: 0.3px">
              {{ customer_id ? 'Update Customer' : 'New Customer' }}
            </span>
            <button
              @click="close_dialog"
              style="
                background: rgba(255, 255, 255, 0.15);
                border: none;
                border-radius: 3px;
                padding: 2px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
              "
            >
              <i
                class="mdi mdi-close"
                style="
                  color: white;
                  font-size: 18px;
                  filter: drop-shadow(0 6px 14px rgba(244, 67, 54, 0.1));
                "
              ></i>
            </button>
          </div>

          <!-- =========================================== -->
          <!-- MODAL BODY -->
          <!-- =========================================== -->
          <div style="padding: 8px 10px">
            <!-- Customer Name -->
            <div style="margin-bottom: 6px">
              <label
                style="
                  display: block;
                  font-size: 11px;
                  color: #555;
                  margin-bottom: 2px;
                  font-weight: 500;
                "
              >
                Customer Name *
              </label>
              <input
                type="text"
                v-model="customer_name"
                placeholder="Enter name"
                style="
                  width: 100%;
                  padding: 5px 8px;
                  border: 1px solid #d1d5db;
                  border-radius: 4px;
                  font-size: 12px;
                  color: #1f2937;
                  background: #fff;
                  transition: all 0.2s;
                  outline: none;
                  height: 28px;
                "
              />
            </div>

            <!-- Tax ID & Mobile -->
            <div style="display: flex; gap: 6px; margin-bottom: 6px">
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Tax ID
                </label>
                <input
                  type="text"
                  v-model="tax_id"
                  placeholder="Tax ID"
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                  "
                />
              </div>
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Mobile
                </label>
                <input
                  type="text"
                  v-model="mobile_no"
                  placeholder="Mobile"
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                  "
                />
              </div>
            </div>

            <!-- Email & Gender -->
            <div style="display: flex; gap: 6px; margin-bottom: 6px">
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Email
                </label>
                <input
                  type="email"
                  v-model="email_id"
                  placeholder="Email"
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                  "
                />
              </div>
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Gender
                </label>
                <select
                  v-model="gender"
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                    cursor: pointer;
                    appearance: none;
                    background-image: url('data:image/svg+xml,%3Csvg width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22%23666%22 d=%22M6 9L1 4h10z%22/%3E%3C/svg%3E');
                    background-repeat: no-repeat;
                    background-position: right 6px center;
                    padding-right: 24px;
                  "
                >
                  <option value="">Select</option>
                  <option v-for="g in genders" :key="g" :value="g">{{ g }}</option>
                </select>
              </div>
            </div>

            <!-- Referral Code & Date of Birth -->
            <div style="display: flex; gap: 6px; margin-bottom: 6px">
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Referral Code
                </label>
                <input
                  type="text"
                  v-model="referral_code"
                  placeholder="Code"
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                  "
                />
              </div>
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Date of Birth
                </label>
                <input
                  type="text"
                  v-model="birthday"
                  readonly
                  @click="birthday_menu = true"
                  placeholder="DOB"
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #f9fafb;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                    cursor: not-allowed;
                  "
                />

                <!-- Date Picker -->
                <div
                  v-if="birthday_menu"
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
                  "
                  @click="birthday_menu = false"
                >
                  <div
                    @click.stop
                    style="
                      background: white;
                      border-radius: 8px;
                      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                      max-width: 290px;
                      width: 90%;
                      max-height: 90vh;
                      overflow: hidden;
                      padding: 16px;
                    "
                  >
                    <div style="display: flex; justify-content: center; align-items: center">
                      <input
                        type="date"
                        v-model="birthday"
                        :max="frappe.datetime.now_date()"
                        @change="birthday_menu = false"
                        style="
                          width: 100%;
                          padding: 8px 12px;
                          border: 1px solid #d0d0d0;
                          border-radius: 6px;
                          font-size: 0.9rem;
                          outline: none;
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Customer Group & Territory -->
            <div style="display: flex; gap: 6px; margin-bottom: 6px">
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Customer Group *
                </label>
                <select
                  v-model="group"
                  required
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                    cursor: pointer;
                    appearance: none;
                    background-image: url('data:image/svg+xml,%3Csvg width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22%23666%22 d=%22M6 9L1 4h10z%22/%3E%3C/svg%3E');
                    background-repeat: no-repeat;
                    background-position: right 6px center;
                    padding-right: 24px;
                  "
                >
                  <option value="">Select</option>
                  <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
                </select>
              </div>
              <div style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Territory *
                </label>
                <select
                  v-model="territory"
                  required
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1f2937;
                    background: #fff;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                    cursor: pointer;
                    appearance: none;
                    background-image: url('data:image/svg+xml,%3Csvg width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22%23666%22 d=%22M6 9L1 4h10z%22/%3E%3C/svg%3E');
                    background-repeat: no-repeat;
                    background-position: right 6px center;
                    padding-right: 24px;
                  "
                >
                  <option value="">Select</option>
                  <option v-for="t in territorys" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
            </div>

            <!-- Loyalty Program & Points (if available) -->
            <div
              v-if="loyalty_program || loyalty_points"
              style="display: flex; gap: 6px; margin-bottom: 6px"
            >
              <div v-if="loyalty_program" style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Loyalty Program
                </label>
                <input
                  type="text"
                  v-model="loyalty_program"
                  readonly
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    background: #f9fafb;
                    color: #6b7280;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                    cursor: not-allowed;
                  "
                />
              </div>
              <div v-if="loyalty_points" style="flex: 1; min-width: 0; margin-bottom: 6px">
                <label
                  style="
                    display: block;
                    font-size: 11px;
                    color: #555;
                    margin-bottom: 2px;
                    font-weight: 500;
                  "
                >
                  Points
                </label>
                <input
                  type="text"
                  v-model="loyalty_points"
                  readonly
                  style="
                    width: 100%;
                    padding: 5px 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 12px;
                    background: #f9fafb;
                    color: #6b7280;
                    transition: all 0.2s;
                    outline: none;
                    height: 28px;
                    cursor: not-allowed;
                  "
                />
              </div>
            </div>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- MODAL FOOTER -->
        <!-- =========================================== -->
        <div
          style="
            display: flex;
            justify-content: flex-end;
            gap: 6px;
            padding: 6px 10px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          "
        >
          <!-- Cancel Button -->
          <button
            @click="close_dialog"
            style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 10px;
              border-radius: 4px;
              border: 1px solid #d1d5db;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
              height: 26px;
              background: white;
              color: #374151;
            "
          >
            <i class="mdi mdi-close" style="font-size: 13px"></i> Cancel
          </button>

          <!-- Submit Button -->
          <button
            @click="submit_dialog"
            style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 10px;
              border-radius: 4px;
              border: 1px solid #1565c0;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
              height: 26px;
              background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
              color: white;
            "
          >
            <i class="mdi mdi-check" style="font-size: 13px"></i>
            {{ customer_id ? 'Update' : 'Register' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./UpdateCustomer.js" />
