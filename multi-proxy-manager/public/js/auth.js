/**
 * auth.js - Authentication helpers shared across all proxy-manager pages.
 * Depends on utils.js (esc).
 */
(function(exports, utils) {

  // ===== Get Auth Token =====
  exports.getAuthToken = function() {
    return sessionStorage.getItem('auth_token');
  };

  // ===== Inject Auth Headers into fetch Options =====
  exports.injectAuthHeaders = function(options) {
    if (options === undefined) options = {};
    if (typeof options !== 'object') options = {};
    if (!options.headers) options.headers = {};
    if (typeof options.headers === 'object') {
      var token = sessionStorage.getItem('auth_token');
      if (token) {
        options.headers['x-auth-token'] = token;
      }
    }
    return options;
  };

  // ===== Intercept window.fetch to auto-inject auth headers for /api/ routes =====
  exports.interceptFetch = function() {
    var origFetch = window.fetch;
    var token = sessionStorage.getItem('auth_token');
    if (!token) return;
    window.fetch = function(url, options) {
      if (options === undefined) options = {};
      if (typeof url === 'string' && url.indexOf('/api/') === 0) {
        if (!options.headers) options.headers = {};
        if (typeof options.headers === 'object') {
          options.headers['x-auth-token'] = token;
        }
      }
      return origFetch(url, options);
    };
  };

  // ===== Logout: clear token and redirect to login =====
  exports.handleLogout = function() {
    sessionStorage.removeItem('auth_token');
    window.location.href = 'login.html';
  };

  // ===== Check auth status via /api/auth/status =====
  exports.checkAuth = function(onAuthenticated, onUnauthorized) {
    return fetch('/api/auth/status')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.needsSetup) {
          if (typeof onUnauthorized === 'function') onUnauthorized(data);
          return false;
        }
        if (typeof onAuthenticated === 'function') onAuthenticated(data);
        return true;
      })
      .catch(function(err) {
        console.warn('Auth check failed:', err);
        if (typeof onAuthenticated === 'function') onAuthenticated(null);
        return true; // allow page to proceed even if auth check fails
      });
  };

})(typeof window !== 'undefined' ? window : {}, typeof window !== 'undefined' ? window : {});
