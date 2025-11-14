<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- POS OFFERS COMPONENT -->
  <!-- =========================================== -->
  <div
    v-if="offersEnabled"
    style="
      display: flex;
      flex-direction: column;
      height: 91vh;
      background: #f8f9fa;
    "
  >
    <!-- =========================================== -->
    <!-- HEADER WITH STATS -->
    <!-- =========================================== -->
    <div
      style="
        background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
        padding: 8px 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 10;
      "
    >
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <div style="display: flex; align-items: center; gap: 6px">
          <i
            class="mdi mdi-tag-multiple"
            style="color: white; font-size: 22px"
          ></i>
          <h2
            style="
              color: white;
              font-size: 1rem;
              font-weight: 600;
              margin: 0;
              letter-spacing: 0.3px;
            "
          >
            <!-- Special Offers Total -->
            إجمالي العروض الخاصة
          </h2>
        </div>

        <div style="display: flex; gap: 6px">
          <!-- Total Badge -->
          <div
            style="
              background: rgba(255, 255, 255, 0.2);
              border-radius: 16px;
              padding: 3px 10px;
              display: flex;
              gap: 6px;
              align-items: center;
              min-width: 50px;
              backdrop-filter: blur(10px);
            "
          >
            <span
              style="
                font-size: 0.6rem;
                color: rgba(255, 255, 255, 0.9);
                text-transform: uppercase;
                font-weight: 500;
                line-height: 1;
              "
            >
              <!-- Total -->
              الإجمالي
            </span>
            <span
              style="
                font-size: 0.6rem;
                color: white;
                font-weight: 700;
                line-height: 1;
              "
            >
              {{ offersCount }}
            </span>
          </div>

          <!-- Active Badge -->
          <div
            style="
              background: rgba(76, 175, 80, 0.9);
              border-radius: 16px;
              padding: 3px 10px;
              display: flex;
              gap: 6px;
              align-items: center;
              min-width: 50px;
            "
          >
            <span
              style="
                font-size: 0.6rem;
                color: rgba(255, 255, 255, 0.9);
                text-transform: uppercase;
                font-weight: 500;
                line-height: 1;
              "
            >
              <!-- Active -->
              مفعل
            </span>
            <span
              style="
                font-size: 0.6rem;
                color: white;
                font-weight: 700;
                line-height: 1;
              "
            >
              {{ appliedOffersCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- =========================================== -->
    <!-- OFFERS GRID -->
    <!-- =========================================== -->
    <div
      style="
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 8px;
        align-content: start;
      "
    >
      <div v-for="(offer, idx) in pos_offers" :key="idx" style="display: flex">
        <div
          style="
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            cursor: pointer;
            display: flex;
            flex-direction: column;
            width: 100%;
            border: 2px solid transparent;
          "
          :style="
            offer.offer_applied
              ? 'border-color: #4caf50; box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3); background: linear-gradient(135deg, #ffffff 0%, #f1f8f4 100%)'
              : ''
          "
        >
          <!-- =========================================== -->
          <!-- OFFER IMAGE WITH OVERLAY -->
          <!-- =========================================== -->
          <div style="position: relative; height: 70px; overflow: hidden">
            <img
              :src="
                offer.image ||
                '/assets/posawesome/js/posapp/components/pos/placeholder-image.png'
              "
              @error="handleImageError"
              style="width: 100%; height: 100%; object-fit: cover"
            />

            <!-- Image Overlay -->
            <div
              style="
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(
                  to top,
                  rgba(0, 0, 0, 0.8),
                  transparent
                );
                padding: 4px 6px 3px;
              "
            >
              <div
                style="
                  color: white;
                  font-size: 0.65rem;
                  font-weight: 600;
                  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
                  line-height: 1.2;
                "
              >
                {{ truncateName(offer.name, 15) }}
              </div>
            </div>

            <!-- Applied Badge -->
            <div
              v-if="offer.offer_applied"
              style="
                position: absolute;
                top: 4px;
                right: 4px;
                background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 2px;
                font-size: 0.6rem;
                font-weight: 600;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
              "
            >
              <i
                class="mdi mdi-check-circle"
                style="color: white; font-size: 14px"
              ></i>
              <!-- Active -->
              <span>مفعل</span>
            </div>
          </div>

          <!-- =========================================== -->
          <!-- OFFER CONTENT -->
          <!-- =========================================== -->
          <div
            style="
              padding: 6px;
              display: flex;
              flex-direction: column;
              gap: 5px;
              flex: 1;
            "
          >
            <!-- Discount Info -->
            <div style="flex: 1">
              <div
                v-if="offer.discount_percentage"
                style="
                  display: flex;
                  align-items: baseline;
                  gap: 3px;
                  padding: 3px 0;
                "
              >
                <span
                  style="
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1976d2;
                    line-height: 1;
                  "
                >
                  {{ offer.discount_percentage }}%
                </span>
                <span
                  style="
                    font-size: 0.6rem;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.3px;
                  "
                >
                  <!-- OFF -->
                  خصم
                </span>
              </div>

              <div
                v-else-if="offer.discount_amount"
                style="
                  display: flex;
                  align-items: baseline;
                  gap: 3px;
                  padding: 3px 0;
                "
              >
                <span
                  style="
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1976d2;
                    line-height: 1;
                  "
                >
                  {{ formatCurrency(offer.discount_amount) }}
                </span>
                <span
                  style="
                    font-size: 0.6rem;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.3px;
                  "
                >
                  <!-- OFF -->
                  خصم
                </span>
              </div>

              <div
                v-else
                style="
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  padding: 3px 0;
                "
              >
                <i
                  class="mdi mdi-gift"
                  style="color: #4caf50; font-size: 18px"
                ></i>
                <span
                  style="
                    font-size: 0.6rem;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.3px;
                  "
                >
                  <!-- Special Offer -->
                  عرض خاص
                </span>
              </div>
            </div>

            <!-- Warning Message -->
            <div
              v-if="
                offer.offer_type === 'Grand Total' &&
                !offer.offer_applied &&
                discount_percentage_offer_name &&
                discount_percentage_offer_name !== offer.name
              "
              style="
                display: flex;
                align-items: center;
                gap: 3px;
                background: rgba(255, 152, 0, 0.1);
                padding: 3px 5px;
                border-radius: 4px;
                font-size: 0.6rem;
                color: #f57c00;
                border-left: 2px solid #ff9800;
              "
            >
              <i
                class="mdi mdi-alert-circle"
                style="color: #ff9800; font-size: 12px"
              ></i>
              <!-- Another offer active -->
              <span>عرض آخر نشط</span>
            </div>

            <!-- Apply Toggle -->
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 0 0;
                border-top: 1px solid #f0f0f0;
              "
            >
              <label
                style="
                  position: relative;
                  display: inline-block;
                  width: 32px;
                  height: 16px;
                  flex-shrink: 0;
                "
              >
                <input
                  type="checkbox"
                  v-model="offer.offer_applied"
                  @change="toggleOffer(offer)"
                  :disabled="isOfferDisabled(offer)"
                  style="opacity: 0; width: 0; height: 0"
                />
                <span
                  style="
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    border-radius: 20px;
                    transition: 0.3s;
                  "
                >
                  <span
                    style="
                      position: absolute;
                      content: '';
                      height: 11px;
                      width: 11px;
                      left: 2.5px;
                      bottom: 2.5px;
                      background-color: white;
                      border-radius: 50%;
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                      transition: 0.3s;
                    "
                    :style="
                      offer.offer_applied
                        ? 'transform: translateX(16px); background-color: white'
                        : ''
                    "
                  ></span>
                </span>
                <!-- Applied / Apply -->
                <span
                  style="
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: #666;
                    margin-left: 8px;
                  "
                >
                  {{ offer.offer_applied ? "مطبق" : "تطبيق" }}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =========================================== -->
    <!-- FOOTER -->
    <!-- =========================================== -->
    <div
      style="
        padding: 8px 12px;
        background: white;
        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
        z-index: 10;
      "
    >
      <button
        @click="back_to_invoice"
        style="
          width: 100%;
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
        "
      >
        <i class="mdi mdi-arrow-left" style="font-size: 18px"></i>
        <!-- Back to Invoice -->
        <span>رجوع إلى الفاتورة</span>
      </button>
    </div>
  </div>

  <!-- =========================================== -->
  <!-- OFFERS DISABLED MESSAGE -->
  <!-- =========================================== -->
  <div
    v-else
    style="
      display: flex;
      flex-direction: column;
      height: 91vh;
      background: #f8f9fa;
      align-items: center;
      justify-content: center;
    "
  >
    <div
      style="
        text-align: center;
        padding: 40px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        max-width: 400px;
      "
    >
      <i
        class="mdi mdi-tag-off"
        style="font-size: 48px; color: #ccc; margin-bottom: 16px"
      ></i>

      <!-- Offers Disabled -->
      <h3 style="color: #666; margin-bottom: 8px; font-size: 1.2rem">
        العروض غير مفعلة
      </h3>

      <!-- Offers are disabled in POS Profile settings -->
      <p style="color: #999; margin-bottom: 24px; font-size: 0.9rem">
        تم تعطيل العروض في إعدادات ملف نقاط البيع
      </p>

      <button
        @click="back_to_invoice"
        style="
          width: 100%;
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
        "
      >
        <i class="mdi mdi-arrow-left" style="font-size: 18px"></i>
        <!-- Back to Invoice -->
        <span>رجوع إلى الفاتورة</span>
      </button>
    </div>
  </div>
</template>

<script src="./PosOffers.js" />
