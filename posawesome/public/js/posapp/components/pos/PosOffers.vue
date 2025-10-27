<template>
  <div v-if="offersEnabled" class="offers-wrapper">
    <!-- HEADER WITH STATS -->
    <div class="offers-header">
      <div class="header-content">
        <div class="header-left">
          <i class="mdi mdi-tag-multiple header-icon"></i>
          <h2 class="header-title">{{ __("Special Offers Total") }}</h2>
        </div>
        <div class="header-stats">
          <div class="stat-badge">
            <span class="stat-label">{{ __("Total") }}</span>
            <span class="stat-value">{{ offersCount }}</span>
          </div>
          <div class="stat-badge active">
            <span class="stat-label">{{ __("Active") }}</span>
            <span class="stat-value">{{ appliedOffersCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- OFFERS GRID -->
    <div class="offers-grid">
      <div v-for="(offer, idx) in pos_offers" :key="idx" class="offer-card-wrapper">
        <div class="offer-card" :class="{ 'offer-active': offer.offer_applied }">
          <!-- OFFER IMAGE WITH OVERLAY -->
          <div class="offer-image-container">
            <img :src="offer.image ||
              '/assets/posawesome/js/posapp/components/pos/placeholder-image.png'
              " class="offer-image" @error="handleImageError" />
            <div class="offer-overlay">
              <div class="offer-name">{{ truncateName(offer.name, 15) }}</div>
            </div>

            <!-- APPLIED BADGE -->
            <div v-if="offer.offer_applied" class="applied-badge">
              <i class="mdi mdi-check-circle badge-icon"></i>
              <span>{{ __("Active") }}</span>
            </div>
          </div>

          <!-- OFFER CONTENT -->
          <div class="offer-content">
            <!-- DISCOUNT INFO -->
            <div class="discount-info">
              <div v-if="offer.discount_percentage" class="discount-main">
                <span class="discount-value">{{ offer.discount_percentage }}%</span>
                <span class="discount-label">OFF</span>
              </div>
              <div v-else-if="offer.discount_amount" class="discount-main">
                <span class="discount-value">{{
                  formatCurrency(offer.discount_amount)
                }}</span>
                <span class="discount-label">OFF</span>
              </div>
              <div v-else class="discount-main special">
                <i class="mdi mdi-gift gift-icon"></i>
                <span class="discount-label">{{ __("Special Offer") }}</span>
              </div>
            </div>

            <!-- WARNING MESSAGE -->
            <div v-if="
              offer.offer_type === 'Grand Total' &&
              !offer.offer_applied &&
              discount_percentage_offer_name &&
              discount_percentage_offer_name !== offer.name
            " class="warning-msg">
              <i class="mdi mdi-alert-circle warning-icon"></i>
              <span>{{ __("Another offer active") }}</span>
            </div>

            <!-- APPLY TOGGLE -->
            <div class="offer-toggle">
              <label class="toggle-switch">
                <input type="checkbox" v-model="offer.offer_applied" @change="handleOfferToggle"
                  :disabled="isOfferDisabled(offer)" />
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-text">{{
                offer.offer_applied ? __("Applied") : __("Apply")
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="offers-footer">
      <button class="back-button" @click="back_to_invoice">
        <i class="mdi mdi-arrow-left back-icon"></i>
        <span>{{ __("Back to Invoice") }}</span>
      </button>
    </div>
  </div>
  <div v-else class="offers-disabled">
    <div class="disabled-message">
      <i class="mdi mdi-tag-off disabled-icon"></i>
      <h3>{{ __("Offers Disabled") }}</h3>
      <p>{{ __("Offers are disabled in POS Profile settings") }}</p>
      <button class="back-button" @click="back_to_invoice">
        <i class="mdi mdi-arrow-left back-icon"></i>
        <span>{{ __("Back to Invoice") }}</span>
      </button>
    </div>
  </div>
</template>

<script src="./PosOffers.js" />

<style scoped>
/* ===== WRAPPER ===== */
.offers-wrapper {
  display: flex;
  flex-direction: column;
  height: 91vh;
  background: #f8f9fa;
  /* Simple background - no gradient */
}

/* ===== HEADER ===== */
.offers-header {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-icon {
  color: white;
  font-size: 22px;
}

.header-title {
  color: white;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.3px;
}

.header-stats {
  display: flex;
  gap: 6px;
}

.stat-badge {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 3px 10px;
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 50px;
  backdrop-filter: blur(10px);
}

.stat-badge.active {
  background: rgba(76, 175, 80, 0.9);
}

.stat-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  font-weight: 500;
  line-height: 1;
}

.stat-value {
  font-size: 0.6rem;
  color: white;
  font-weight: 700;
  line-height: 1;
}

/* ===== OFFERS GRID ===== */
.offers-grid {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  align-content: start;
}

/* Custom scrollbar */
.offers-grid::-webkit-scrollbar {
  width: 6px;
}

.offers-grid::-webkit-scrollbar-track {
  background: transparent;
}

.offers-grid::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.offers-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* ===== OFFER CARD ===== */
.offer-card-wrapper {
  display: flex;
}

.offer-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 2px solid transparent;
}

.offer-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-color: rgba(25, 118, 210, 0.3);
}

.offer-card.offer-active {
  border-color: #4caf50;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, #f1f8f4 100%);
}

/* ===== IMAGE CONTAINER ===== */
.offer-image-container {
  position: relative;
  height: 70px;
  overflow: hidden;
}

.offer-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.offer-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 4px 6px 3px;
}

.offer-name {
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  line-height: 1.2;
}

/* ===== APPLIED BADGE ===== */
.applied-badge {
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
}

.badge-icon {
  color: white;
  font-size: 14px;
}

/* ===== OFFER CONTENT ===== */
.offer-content {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

/* ===== DISCOUNT INFO ===== */
.discount-info {
  flex: 1;
}

.discount-main {
  display: flex;
  align-items: baseline;
  gap: 3px;
  padding: 3px 0;
}

.discount-main.special {
  align-items: center;
  gap: 4px;
}

.discount-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1976d2;
  line-height: 1;
}

.discount-label {
  font-size: 0.6rem;
  color: #666;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.gift-icon {
  color: #4CAF50;
  font-size: 18px;
}

/* ===== WARNING MESSAGE ===== */
.warning-msg {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 152, 0, 0.1);
  padding: 3px 5px;
  border-radius: 4px;
  font-size: 0.6rem;
  color: #f57c00;
  border-left: 2px solid #ff9800;
}

.warning-icon {
  color: #ff9800;
  font-size: 12px;
}

/* ===== TOGGLE SWITCH ===== */
.offer-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 0;
  border-top: 1px solid #f0f0f0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 16px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 11px;
  width: 11px;
  left: 2.5px;
  bottom: 2.5px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.toggle-switch input:checked+.toggle-slider {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
}

.toggle-switch input:checked+.toggle-slider:before {
  transform: translateX(16px);
}

.toggle-switch input:disabled+.toggle-slider {
  background-color: #e0e0e0;
  cursor: not-allowed;
  opacity: 0.5;
}

.toggle-text {
  font-size: 0.65rem;
  font-weight: 600;
  color: #666;
}

.toggle-switch input:checked~.toggle-text {
  color: #4caf50;
}

/* ===== FOOTER ===== */
.offers-footer {
  padding: 8px 12px;
  background: white;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.back-button {
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
}

.back-button:hover {
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
}

.back-icon {
  font-size: 18px;
}

@media (min-width: 1200px) {
  .offers-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}

/* ===== DISABLED MESSAGE ===== */
.offers-disabled {
  display: flex;
  flex-direction: column;
  height: 91vh;
  background: #f8f9fa;
  align-items: center;
  justify-content: center;
}

.disabled-message {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.disabled-icon {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 16px;
}

.disabled-message h3 {
  color: #666;
  margin-bottom: 8px;
  font-size: 1.2rem;
}

.disabled-message p {
  color: #999;
  margin-bottom: 24px;
  font-size: 0.9rem;
}
</style>
