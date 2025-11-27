<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- OPEN SHIFTS WARNING DIALOG -->
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
      @click="handleClose"
    >
      <!-- Dialog Container -->
      <div
        style="
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          max-width: 600px;
          width: 100%;
          border: 1px solid rgba(255, 152, 0, 0.1);
        "
        @click.stop
      >
        <!-- =========================================== -->
        <!-- HEADER (مطابق لنافذة فتح الوردية) -->
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
                class="mdi mdi-alert-circle"
                style="color: white; font-size: 18px"
              ></i>
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
              Multiple Open Shifts
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
            "
            @click="handleClose"
          >
            <i class="mdi mdi-close" style="color: white; font-size: 14px"></i>
          </button>
        </div>

        <!-- =========================================== -->
        <!-- CONTENT (مطابق لنافذة فتح الوردية) -->
        <!-- =========================================== -->
        <div style="padding: 12px; background: #fafbfc">
          <!-- Warning Message -->
          <div
            style="
              background: #fff3e0;
              border-left: 3px solid #ff9800;
              padding: 10px 12px;
              border-radius: 6px;
              margin-bottom: 12px;
            "
          >
            <p
              style="
                margin: 0;
                color: #e65100;
                font-weight: 500;
                font-size: 13px;
                line-height: 1.5;
              "
            >
              <i class="mdi mdi-information" style="margin-right: 6px"></i>
              <!-- You have X open shift(s). Please close these shifts before opening a new one. -->
              لديك {{ shifts.length }} وردية مفتوحة. يرجى إغلاق هذه الورديات قبل
              فتح وردية جديدة.
            </p>
          </div>

          <!-- Shifts Table -->
          <div
            style="
              background: white;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
              margin-bottom: 12px;
            "
          >
            <table style="width: 100%; border-collapse: collapse">
              <thead>
                <tr
                  style="
                    background: linear-gradient(
                      to bottom,
                      #f9fafb 0%,
                      #f3f4f6 100%
                    );
                  "
                >
                  <th
                    style="
                      padding: 10px 12px;
                      text-align: left;
                      font-size: 11px;
                      font-weight: 600;
                      color: #6b7280;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      border-bottom: 1px solid #e5e7eb;
                    "
                  >
                    Shift ID
                  </th>
                  <th
                    style="
                      padding: 10px 12px;
                      text-align: left;
                      font-size: 11px;
                      font-weight: 600;
                      color: #6b7280;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      border-bottom: 1px solid #e5e7eb;
                    "
                  >
                    POS Profile
                  </th>
                  <th
                    style="
                      padding: 10px 12px;
                      text-align: left;
                      font-size: 11px;
                      font-weight: 600;
                      color: #6b7280;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      border-bottom: 1px solid #e5e7eb;
                    "
                  >
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(shift, index) in shifts"
                  :key="shift.name"
                  :style="{
                    background: index % 2 === 0 ? 'white' : '#f9fafb',
                    borderBottom:
                      index < shifts.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }"
                >
                  <td style="padding: 10px 12px">
                    <a
                      :href="getShiftUrl(shift.name)"
                      target="_blank"
                      style="
                        color: #3b82f6;
                        font-weight: 600;
                        font-size: 12px;
                        font-family: 'Courier New', monospace;
                        text-decoration: none;
                      "
                    >
                      {{ shift.name }}
                      <i
                        class="mdi mdi-open-in-new"
                        style="font-size: 10px; margin-left: 4px"
                      ></i>
                    </a>
                  </td>
                  <td
                    style="
                      padding: 10px 12px;
                      color: #374151;
                      font-size: 13px;
                      font-weight: 500;
                    "
                  >
                    {{ shift.pos_profile }}
                  </td>
                  <td
                    style="padding: 10px 12px; color: #6b7280; font-size: 12px"
                  >
                    {{ formatDateTime(shift.period_start_date) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- =========================================== -->
        <!-- FOOTER (مطابق لنافذة فتح الوردية) -->
        <!-- =========================================== -->
        <div
          style="
            padding: 12px;
            background: white;
            border-top: 1px solid #e5e7eb;
            display: flex;
            gap: 8px;
            justify-content: flex-end;
          "
        >
          <button
            @click="handleClose"
            style="
              background: #f3f4f6;
              color: #374151;
              border: 1px solid #d1d5db;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            <i class="mdi mdi-arrow-left" style="margin-right: 4px"></i>
            Go to Desk
          </button>
          <button
            @click="handleRefresh"
            style="
              background: linear-gradient(135deg, #ff6f00 0%, #ff9800 100%);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(255, 152, 0, 0.2);
            "
            @mouseenter="
              $event.target.style.background = '#ff9800';
              $event.target.style.borderColor = '#f57c00';
              $event.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            "
            @mouseleave="
              $event.target.style.background = 'linear-gradient(135deg, #ff6f00 0%, #ff9800 100%)';
              $event.target.style.borderColor = '';
              $event.target.style.boxShadow = '0 2px 4px rgba(255, 152, 0, 0.2)';
            "
          >
            <i class="mdi mdi-refresh" style="margin-right: 4px"></i>
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./OpenShiftsWarning.js" />

