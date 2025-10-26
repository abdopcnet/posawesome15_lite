<template>
  <nav>
    <div class="custom-navbar">
      <!-- Logo/Title -->
      <div class="nav-brand" @click="go_desk" title="Go to Desk">
        <i class="mdi mdi-point-of-sale" style="font-size: 16px; color: var(--primary);"></i>
      </div>

      <!-- Info Badges -->
      <div class="nav-badges">
        <div class="badge" :class="invoiceNumberClass">
          <i class="mdi mdi-receipt" :style="`font-size: 12px; color: ${invoiceIconColor};`"></i>
          <span>{{ invoiceNumberText }}</span>
        </div>

        <div class="badge" :class="shiftNumberClass">
          <i class="mdi mdi-clock-outline" :style="`font-size: 12px; color: ${shiftIconColor};`"></i>
          <span>{{ shiftNumberText }}</span>
        </div>

        <div class="badge user-badge">
          <i class="mdi mdi-account" style="font-size: 12px; color: var(--primary);"></i>
          <span>{{ currentUserName }}</span>
        </div>

        <div class="badge" :class="shiftStartClass">
          <i class="mdi mdi-clock-start" :style="`font-size: 12px; color: ${shiftStartIconColor};`"></i>
          <span>{{ shiftStartText }}</span>
        </div>

        <div class="badge totals-badge">
          <i class="mdi mdi-counter" style="font-size: 12px; color: var(--primary);"></i>
          <span>QTY: {{ totalInvoicesQty }}</span>
        </div>

        <div class="badge cash-badge">
          <i class="mdi mdi-cash-multiple" style="font-size: 12px; color: var(--success);"></i>
          <span>{{ formatCurrency(totalCash) }}</span>
        </div>

        <div class="badge card-badge">
          <i class="mdi mdi-credit-card" style="font-size: 12px; color: var(--primary);"></i>
          <span>{{ formatCurrency(totalNonCash) }}</span>
        </div>

        <div class="badge" :class="pingClass">
          <i class="mdi mdi-wifi" :style="`font-size: 12px; color: ${pingIconColor};`"></i>
          <span>{{ pingTime }}ms</span>
        </div>

        <div class="badge profile-badge">
          <i class="mdi mdi-briefcase" style="font-size: 12px; color: var(--primary);"></i>
          <span>{{ pos_profile.name }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="nav-actions">
        <button class="action-btn" :class="{ disabled: !last_invoice }" :disabled="!last_invoice"
          @click="print_last_invoice" :title="last_invoice ? 'Print Last Receipt' : 'No last receipt'">
          <i class="mdi mdi-printer"
            :style="`font-size: 14px; color: ${last_invoice ? 'var(--primary)' : 'var(--gray-500)'};`"></i>
        </button>

        <button class="action-btn cache-btn" @click="clearCache" title="Clear Cache">
          <i class="mdi mdi-cached" style="font-size: 14px; color: var(--warning);"></i>
        </button>

        <div class="menu-wrapper">
          <div class="dropdown">
            <button class="action-btn menu-btn" @click="toggleMenu">
              <i class="mdi mdi-menu" style="font-size: 14px;"></i>
              <span>{{ __("Menu") }}</span>
            </button>
            <div v-if="showMenu" class="dropdown-menu">
              <div class="menu-list">
                <div class="menu-item" @click="close_shift_dialog"
                  v-if="!pos_profile.posa_hide_closing_shift && menu_item == 0">
                  <div class="menu-icon close-shift-icon">
                    <i class="mdi mdi-content-save-move-outline" style="font-size: 16px;"></i>
                  </div>
                  <div class="menu-text">Close Shift</div>
                </div>

                <div class="menu-item" @click="logOut">
                  <div class="menu-icon logout-icon">
                    <i class="mdi mdi-logout" style="font-size: 16px;"></i>
                  </div>
                  <div class="menu-text">Logout</div>
                </div>

                <div class="menu-item" @click="go_about">
                  <div class="menu-icon about-icon">
                    <i class="mdi mdi-information-outline" style="font-size: 16px;"></i>
                  </div>
                  <div class="menu-text">About System</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="snack" class="snackbar" :class="snackColor" @click="snack = false">
      {{ snackText }}
    </div>
    <div v-if="freeze" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">{{ freezeTitle }}</h3>
        </div>
        <div class="modal-body">
          {{ freezeMsg }}
        </div>
      </div>
    </div>
  </nav>
</template>

<script src="./Navbar.js" />

<style scoped>
/* Ultra-compact custom navbar */
.custom-navbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  height: 32px;
  position: sticky;
  top: 0;
  z-index: 1100;
}

/* Brand/Logo */
.nav-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.nav-brand:hover {
  background: rgba(25, 118, 210, 0.08);
}

/* Badges Container */
.nav-badges {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-badges::-webkit-scrollbar {
  display: none;
}

/* Badge Styles - Ultra Compact */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  background: #fff;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.2s;
  line-height: 1;
  height: 22px;
}

.badge span {
  white-space: nowrap;
}

/* Badge Variants */
.badge.regular-invoice {
  border-color: #1976d2;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
}

.badge.return-invoice {
  border-color: #d32f2f;
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  color: #d32f2f;
}

.badge.no-invoice {
  border-color: #bdbdbd;
  background: #f5f5f5;
  color: #757575;
  font-style: italic;
}

.badge.open-shift {
  border-color: #4caf50;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
}

.badge.closed-shift {
  border-color: #ff9800;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #f57c00;
}

.badge.no-shift {
  border-color: #bdbdbd;
  background: #f5f5f5;
  color: #757575;
  font-style: italic;
}

.badge.user-badge {
  border-color: #1976d2;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
}

.badge.shift-active {
  border-color: #4caf50;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
}

.badge.no-shift-start {
  border-color: #bdbdbd;
  background: #f5f5f5;
  color: #757575;
}

.badge.totals-badge {
  border-color: #1976d2;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
}

.badge.ping-excellent {
  border-color: #4caf50;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
}

.badge.ping-good {
  border-color: #2196f3;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
}

.badge.ping-fair {
  border-color: #ff9800;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #f57c00;
}

.badge.ping-poor {
  border-color: #f44336;
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  color: #d32f2f;
}

.badge.profile-badge {
  border-color: #1976d2;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
  font-weight: 700;
}

.badge.cash-badge {
  border-color: #4caf50;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
}

.badge.card-badge {
  border-color: #9c27b0;
  background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
  color: #7b1fa2;
}

/* Actions Container */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}

/* Action Buttons - Beautiful Custom Design */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 3px 6px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 600;
  height: 24px;
  min-width: 24px;
}

.action-btn:hover:not(.disabled) {
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
  border-color: #bdbdbd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn:active:not(.disabled) {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.action-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cache-btn:hover {
  border-color: #ff9800;
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
}

.menu-btn {
  border-color: #1976d2;
  background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
  color: white;
}

.menu-btn:hover span,
.menu-btn:hover .v-icon {
  color: #1976d2;
}

.menu-btn span {
  color: white;
}

.menu-wrapper {
  display: flex;
}

/* Cache button rotation animation */
.cache-btn:active .v-icon {
  animation: spin 0.4s ease-in-out;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(180deg);
  }
}

/* ===== DROPDOWN MENU STYLES ===== */
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1200;
  min-width: 200px;
  margin-top: 4px;
  overflow: hidden;
  display: block !important;
  /* Force display */
  /* Prevent overflow outside viewport */
  max-width: calc(100vw - 10px);
}

.menu-list {
  padding: 4px;
  background: white;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 6px;
  margin: 2px 0;
  min-height: 40px;
}

.menu-item:hover {
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
}

.menu-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  transition: all 0.2s ease;
}

.close-shift-icon {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
}

.logout-icon {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  color: white;
}

.about-icon {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
}

.menu-item:hover .menu-icon {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.menu-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
  letter-spacing: 0.2px;
}

/* Responsive - tighter at small screens */
@media (max-width: 1024px) {
  .custom-navbar {
    gap: 2px;
    padding: 2px 4px;
  }

  .nav-badges {
    gap: 2px;
  }

  .badge {
    padding: 2px 4px;
    font-size: 10px;
  }
}

/* Legacy styles cleanup */
.margen-top {
  margin-top: 0px;
}

/* ===== SNACKBAR NOTIFICATION STYLES ===== */
.snackbar {
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 300px;
  max-width: 500px;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  z-index: 2000;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease-out;
  text-align: center;
}

.snackbar.success {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  border: 1px solid #4caf50;
}

.snackbar.error {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  border: 1px solid #f44336;
}

.snackbar.info {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  border: 1px solid #2196f3;
}

.snackbar.warning {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  border: 1px solid #ff9800;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Modal overlay styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.modal {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
  color: #666;
  line-height: 1.5;
}
</style>
