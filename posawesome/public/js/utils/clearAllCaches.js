/**
 * Clear All Caches - Frappe Style
 * Based on frappe.assets.clear_local_storage()
 */

class CacheManager {
  constructor() {
    this.isClearing = false;
  }

  clearAllCaches() {
    if (this.isClearing) return false;
    this.isClearing = true;

    try {
      this.clearLocalStorage();
      this.clearSessionStorage();
      return true;
    } catch (error) {
      return false;
    } finally {
      this.isClearing = false;
    }
  }

  clearLocalStorage() {
    // Clear Frappe system keys (same as frappe.assets.clear_local_storage)
    ['_last_load', '_version_number', 'metadata_version', 'page_info', 'last_visited'].forEach(
      (key) => localStorage.removeItem(key),
    );

    // Clear Frappe assets
    for (let key in localStorage) {
      if (
        key.startsWith('_page:') ||
        key.startsWith('_doctype:') ||
        key.startsWith('preferred_breadcrumbs:') ||
        key.startsWith('posawesome_') ||
        key.includes('pos_') ||
        key.includes('invoice_') ||
        key.includes('customer_')
      ) {
        localStorage.removeItem(key);
      }
    }
  }

  clearSessionStorage() {
    sessionStorage.clear();
  }

  reloadPage(delay = 1000) {
    setTimeout(() => location.reload(true), delay);
  }

  showStatus(message, type = 'info') {
    if (window.evntBus) {
      window.evntBus.emit('show_mesage', { text: message, color: type });
    }
  }
}

// Global instance
window.cacheManager = new CacheManager();

// Auto-attach to button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('clear-cache-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      window.cacheManager.showStatus('Clearing cache...', 'info');
      const success = window.cacheManager.clearAllCaches();

      if (success) {
        window.cacheManager.showStatus('Cache cleared. Reloading...', 'success');
        window.cacheManager.reloadPage();
      } else {
        window.cacheManager.showStatus('Error clearing cache', 'error');
      }
    });
  }
});

// Global function
window.clearAllCaches = function () {
  return window.cacheManager.clearAllCaches();
};
