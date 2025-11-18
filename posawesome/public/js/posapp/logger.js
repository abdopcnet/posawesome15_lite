/**
 * POSAwesome Frontend Logger
 * Logs messages to both console and backend via frappe.call
 */

export const posawesome_logger = {
  /**
   * Log info message
   * @param {string} file - Filename where log is triggered
   * @param {string} message - Log message
   * @param {object} data - Additional data to log
   */
  info(file, message, data = null) {
    const logMessage = `[${file}] ${message}`;
    console.log(logMessage, data || "");

    // Send to backend for persistent logging
    this._sendToBackend("info", file, message, data);
  },

  /**
   * Log error message
   * @param {string} file - Filename where error occurred
   * @param {string} message - Error message
   * @param {object} error - Error object or additional data
   */
  error(file, message, error = null) {
    const logMessage = `[${file}] ${message}`;
    console.error(logMessage, error || "");

    // Send to backend for persistent logging
    this._sendToBackend("error", file, message, error);
  },

  /**
   * Log warning message
   * @param {string} file - Filename where warning occurred
   * @param {string} message - Warning message
   * @param {object} data - Additional data to log
   */
  warn(file, message, data = null) {
    const logMessage = `[${file}] ${message}`;
    console.warn(logMessage, data || "");

    // Send to backend for persistent logging
    this._sendToBackend("warn", file, message, data);
  },

  /**
   * Send log to backend
   * @private
   */
  _sendToBackend(level, file, message, data) {
    // Only send errors and important warnings to backend
    if (level === "error" || (level === "warn" && data)) {
      frappe.call({
        method: "posawesome.api.logger.log_frontend",
        args: {
          level: level,
          file: file,
          message: message,
          data: data ? JSON.stringify(data) : null,
        },
        freeze: false,
        async: true,
      });
    }
  },
};

// Make it globally available
window.posawesome_logger = posawesome_logger;
