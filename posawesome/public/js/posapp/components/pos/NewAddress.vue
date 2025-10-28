<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- NEW ADDRESS DIALOG -->
  <!-- =========================================== -->
  <div style="display: flex; justify-content: center; align-items: center">
    <!-- Modal Overlay -->
    <div
      v-if="addressDialog"
      @click="addressDialog = false"
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
          max-width: 480px;
          width: 90%;
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
              padding: 12px 16px;
              border-bottom: 1px solid #e0e0e0;
              background: #f5f5f5;
              position: relative;
            "
          >
            <span style="font-size: 1.25rem; font-weight: 700; color: #1976d2">
              Add New Address
            </span>
            <button
              @click="addressDialog = false"
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
                transition: all 0.2s ease;
              "
            >
              ×
            </button>
          </div>

          <!-- =========================================== -->
          <!-- CARD BODY -->
          <!-- =========================================== -->
          <div style="padding: 8px">
            <div style="padding: 8px">
              <!-- Address Title -->
              <div style="padding: 4px; margin-bottom: 4px">
                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%">
                  <label
                    style="font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 2px"
                  >
                    Address Title
                  </label>
                  <input
                    type="text"
                    v-model="address.name"
                    placeholder="Enter address title"
                    style="
                      width: 100%;
                      padding: 6px 10px;
                      font-size: 0.8rem;
                      min-height: 36px;
                      color: #333;
                      background: white;
                      border: 1px solid #d0d0d0;
                      border-radius: 6px;
                      outline: none;
                      transition: all 0.2s ease;
                    "
                  />
                </div>
              </div>

              <!-- Address Line 1 -->
              <div style="padding: 4px; margin-bottom: 4px">
                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%">
                  <label
                    style="font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 2px"
                  >
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    v-model="address.address_line1"
                    placeholder="Enter address line 1"
                    style="
                      width: 100%;
                      padding: 6px 10px;
                      font-size: 0.8rem;
                      min-height: 36px;
                      color: #333;
                      background: white;
                      border: 1px solid #d0d0d0;
                      border-radius: 6px;
                      outline: none;
                      transition: all 0.2s ease;
                    "
                  />
                </div>
              </div>

              <!-- Address Line 2 -->
              <div style="padding: 4px; margin-bottom: 4px">
                <div style="display: flex; flex-direction: column; gap: 4px; width: 100%">
                  <label
                    style="font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 2px"
                  >
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    v-model="address.address_line2"
                    placeholder="Enter address line 2"
                    style="
                      width: 100%;
                      padding: 6px 10px;
                      font-size: 0.8rem;
                      min-height: 36px;
                      color: #333;
                      background: white;
                      border: 1px solid #d0d0d0;
                      border-radius: 6px;
                      outline: none;
                      transition: all 0.2s ease;
                    "
                  />
                </div>
              </div>

              <!-- City & State -->
              <div style="display: flex; gap: 8px; margin-bottom: 4px">
                <!-- City -->
                <div style="flex: 0 0 calc(50% - 4px); max-width: calc(50% - 4px); padding: 4px">
                  <div style="display: flex; flex-direction: column; gap: 4px; width: 100%">
                    <label
                      style="font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 2px"
                    >
                      City
                    </label>
                    <input
                      type="text"
                      v-model="address.city"
                      placeholder="Enter city"
                      style="
                        width: 100%;
                        padding: 6px 10px;
                        font-size: 0.8rem;
                        min-height: 36px;
                        color: #333;
                        background: white;
                        border: 1px solid #d0d0d0;
                        border-radius: 6px;
                        outline: none;
                        transition: all 0.2s ease;
                      "
                    />
                  </div>
                </div>

                <!-- State -->
                <div style="flex: 0 0 calc(50% - 4px); max-width: calc(50% - 4px); padding: 4px">
                  <div style="display: flex; flex-direction: column; gap: 4px; width: 100%">
                    <label
                      style="font-size: 0.75rem; font-weight: 600; color: #555; margin-bottom: 2px"
                    >
                      State
                    </label>
                    <input
                      type="text"
                      v-model="address.state"
                      placeholder="Enter state"
                      style="
                        width: 100%;
                        padding: 6px 10px;
                        font-size: 0.8rem;
                        min-height: 36px;
                        color: #333;
                        background: white;
                        border: 1px solid #d0d0d0;
                        border-radius: 6px;
                        outline: none;
                        transition: all 0.2s ease;
                      "
                    />
                  </div>
                </div>
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
              padding: 12px 16px 0;
              border-top: 1px solid #e0e0e0;
            "
          >
            <div style="flex: 1"></div>

            <!-- Cancel Button -->
            <button
              @click="close_dialog"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 4px 12px;
                height: 26px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid #9e9e9e;
                transition: all 0.2s ease;
                line-height: 1.5;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                background: white;
                color: #616161;
                border-radius: 6px;
                margin-right: 8px;
              "
            >
              Cancel
            </button>

            <!-- Confirm Button -->
            <button
              @click="submit_dialog"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 4px 12px;
                height: 26px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid #1565c0;
                transition: all 0.2s ease;
                line-height: 1.5;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
                color: white;
                border-radius: 6px;
              "
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./NewAddress.js" />
