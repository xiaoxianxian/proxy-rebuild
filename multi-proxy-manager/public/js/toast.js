/**
 * toast.js - Shared toast notification system.
 * Uses .toast-container and .toast classes from shared-styles.css.
 */
(function(exports) {

  // Icon map for each toast type
  var TOAST_ICONS = {
    success: '✓',
    error: '✗',
    info: 'ℹ️',
    warning: '⚠️'
  };

  // ===== Show Toast Notification =====
  // type: 'success' | 'error' | 'info' | 'warning'
  // duration: ms to display (default 3000)
  exports.showToast = function(message, type, duration) {
    if (duration === undefined) duration = 3000;
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');

    var iconSpan = document.createElement('span');
    iconSpan.textContent = TOAST_ICONS[type] || '';
    var msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);

    container.appendChild(toast);

    setTimeout(function() {
      toast.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(function() { toast.remove(); }, 300);
    }, duration);
  };

})(typeof window !== 'undefined' ? window : {});
