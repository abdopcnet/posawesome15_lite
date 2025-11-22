// ===== OPEN SHIFTS WARNING COMPONENT =====
// Frontend logging: Use console.log/error/warn directly

export default {
  name: "OpenShiftsWarning",

  props: {
    isOpen: {
      type: Boolean,
      required: true,
      default: false,
    },
    shifts: {
      type: Array,
      required: true,
      default: () => [],
    },
  },

  methods: {
    formatDateTime(dateString) {
      if (!dateString) return "";

      try {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      } catch (error) {
        return dateString;
      }
    },

    getShiftUrl(shiftName) {
      // Build URL to open POS Opening Shift document in new tab
      return `/app/pos-opening-shift/${encodeURIComponent(shiftName)}`;
    },

    handleClose() {
      // Go back to desk
      window.location.href = "/app";
    },

    handleRefresh() {
      window.location.reload();
    },
  },
};
