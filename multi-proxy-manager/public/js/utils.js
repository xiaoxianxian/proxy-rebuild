/**
 * utils.js - Shared utility functions for all proxy-manager pages.
 * Included BEFORE auth.js, toast.js, sidebar.js in each HTML page.
 */
(function(exports) {

  // ===== HTML Escaping =====
  exports.esc = function(str) {
    if (str === null || str === undefined) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  };

  // ===== Mock Status Data (fallback when backend unavailable) =====
  exports.getMockStatus = function() {
    return {
      codex: {
        running: true,
        port: 18790,
        pid: 12345,
        uptime: '2h 34m',
        health: { status: 'healthy', latency: '45ms' }
      },
      hermes: {
        running: true,
        port: 18793,
        pid: 12346,
        uptime: '2h 34m',
        health: { status: 'healthy', latency: '62ms' }
      },
      cursor: {
        running: false,
        port: 18794,
        pid: null,
        uptime: null,
        health: null
      }
    };
  };

  // ===== Mock Version Data (fallback when backend unavailable) =====
  exports.getMockVersion = function() {
    return {
      version: '1.0.3',
      proxies: {
        codex: 'v1.2.0',
        hermes: 'v0.9.4',
        cursor: 'v2.1.0'
      }
    };
  };

})(typeof window !== 'undefined' ? window : {});
