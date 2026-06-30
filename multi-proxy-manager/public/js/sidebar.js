/**
 * sidebar.js - Sidebar, navigation, dark mode, and mobile menu shared across pages.
 * Depends on utils.js (esc).
 */
(function(exports, utils) {

  // ===== Initialize Mobile Sidebar (hamburger menu + overlay) =====
  exports.initMobileSidebar = function() {
    var mobileMenuBtn = document.getElementById('mobileMenuBtn');
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');

    if (!mobileMenuBtn || !sidebar || !sidebarOverlay) return;

    mobileMenuBtn.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('show');
    });

    sidebarOverlay.addEventListener('click', exports.closeMobileSidebar);
  };

  // ===== Close mobile sidebar =====
  exports.closeMobileSidebar = function() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  };

  // ===== Switch page (SPA-like: show/hide page sections) =====
  exports.switchPage = function(pageId) {
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.remove('active');
    }
    var navItems = document.querySelectorAll('.nav-item');
    for (var j = 0; j < navItems.length; j++) {
      navItems[j].classList.remove('active');
    }

    var page = document.getElementById('page-' + pageId);
    if (page) page.classList.add('active');

    var nav = document.querySelector('.nav-item[data-page="' + pageId + '"]');
    if (nav) nav.classList.add('active');

    exports.closeMobileSidebar();
  };

  // ===== Render dynamic proxy nav items in sidebar =====
  exports.renderDynamicProxyNav = function(proxyNames, proxyConfigs) {
    var container = document.getElementById('proxyNavItems');
    var label = document.getElementById('proxySectionLabel');
    if (!container) return;

    if (label) {
      label.style.display = proxyNames.length > 0 ? '' : 'none';
    }

    if (proxyNames.length === 0) {
      container.innerHTML = '<div class="nav-item" style="color:var(--color-text-tertiary);font-size:12px;padding:4px 12px;">暂无代理</div>';
      return;
    }

    var configs = proxyConfigs || {};
    container.innerHTML = proxyNames.map(function(name) {
      var config = configs[name] || { name: name, icon: '&#9729;' };
      var escapedName = utils.esc(name);
      var escapedConfigName = utils.esc(config.name);
      return '<a href="proxy-config.html?proxy=' + escapedName + '" ' +
        'class="nav-item proxy-nav-item" ' +
        'data-proxy="' + escapedName + '" ' +
        'data-tooltip="' + escapedConfigName + '" ' +
        'tabindex="0">' +
        '<span class="nav-icon">' + config.icon + '</span>' +
        escapedConfigName +
        '</a>';
    }).join('');
  };

  // ===== Initialize Dark Mode toggle (persisted in localStorage) =====
  exports.initDarkMode = function() {
    var toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;

    var isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      toggle.innerHTML = '&#9728; 亮色模式';
    }

    toggle.addEventListener('click', function() {
      var html = document.documentElement;
      var isNowDark = html.classList.contains('dark');
      if (isNowDark) {
        html.classList.remove('dark');
        html.classList.add('light');
        localStorage.setItem('darkMode', 'false');
        toggle.innerHTML = '&#9789; 暗色模式';
      } else {
        html.classList.add('dark');
        html.classList.remove('light');
        localStorage.setItem('darkMode', 'true');
        toggle.innerHTML = '&#9728; 亮色模式';
      }
    });
  };

  // ===== Setup sidebar navigation click handler =====
  exports.initSidebarNav = function(onPageSwitch) {
    var sidebarNav = document.getElementById('sidebarNav');
    if (!sidebarNav) return;

    sidebarNav.addEventListener('click', function(e) {
      var navItem = e.target.closest('.nav-item');
      if (!navItem) return;

      // Handle proxy nav items — navigate to proxy-config page
      if (navItem.classList.contains('proxy-nav-item')) {
        exports.closeMobileSidebar();
        return;
      }

      var pageId = navItem.dataset.page;
      if (pageId) {
        if (typeof onPageSwitch === 'function') {
          onPageSwitch(pageId);
        } else {
          exports.switchPage(pageId);
        }
      }
    });
  };

})(typeof window !== 'undefined' ? window : {}, typeof window !== 'undefined' ? window : {});
