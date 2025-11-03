// ui.js - Utilidades básicas de UI y navegación
(function(){
  // Detectar modo oscuro
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  window.isDarkMode = mq ? mq.matches : false;
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', (e) => { window.isDarkMode = e.matches; });
  }

  // Fallback simple de notificación si no existe notifications.js
  function simpleToast(message, type = 'info', duration = 3000) {
    const el = document.createElement('div');
    el.className = `simple-toast ${type}`;
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.bottom = '16px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.background = type === 'error' ? '#f72585' : (type === 'success' ? '#4cc9f0' : '#4361ee');
    el.style.color = '#fff';
    el.style.padding = '10px 16px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    el.style.zIndex = 9999;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  const UIManager = {
    showToast(message, type = 'info', duration = 3000) {
      if (typeof window.showNotification === 'function') {
        try { window.showNotification(message, type, duration); return; } catch (_) {}
      }
      simpleToast(message, type, duration);
    }
  };

  function ensureMain() {
    return document.getElementById('mainContent');
  }

  function loadContent(tab) {
    const t = (tab || 'dashboard').toLowerCase();
    try {
      switch (t) {
        case 'dashboard':
          if (typeof window.loadDashboard === 'function') return window.loadDashboard();
          break;
        case 'transactions':
          if (typeof window.loadTransactions === 'function') return window.loadTransactions();
          break;
        case 'subject':
          if (typeof window.loadSubjectTab === 'function') return window.loadSubjectTab();
          break;
        case 'categories':
          {
            const main = ensureMain();
            if (main) main.innerHTML = '<section class="categories-analysis"><h2>Cargando Categorías…</h2></section>';
            if (typeof window.loadCategoriesAnalysis === 'function') {
              try {
                const p = window.loadCategoriesAnalysis();
                // Fallback: si en 1500ms no se ha renderizado, mostramos aviso
                setTimeout(() => {
                  const hasSummary = document.getElementById('analysis-summary');
                  if (!hasSummary) {
                    const m = ensureMain();
                    if (m) m.innerHTML = '<section class="categories-analysis"><h2>Categorías</h2><p class="empty-state">No se pudo cargar el análisis. Comprueba que hay transacciones.</p></section>';
                    UIManager.showToast('No se pudo cargar Categorías', 'warning');
                  }
                }, 1500);
                return p;
              } catch (e) {
                console.error('Error al cargar análisis de categorías:', e);
                const m = ensureMain();
                if (m) m.innerHTML = '<section class="categories-analysis"><h2>Categorías</h2><p class="empty-state">Error cargando el análisis</p></section>';
                UIManager.showToast('Error cargando Categorías', 'error');
              }
            }
          }
          break;
        case 'scanner':
          if (typeof window.loadScanner === 'function') return window.loadScanner();
          break;
        case 'forecast':
          if (typeof window.loadForecast === 'function') return window.loadForecast();
          break;
        case 'financing':
          if (typeof window.loadFinancing === 'function') return window.loadFinancing();
          break;
        case 'settings':
          if (typeof window.loadSettings === 'function') return window.loadSettings();
          break;
      }
      const main = ensureMain();
      if (main) main.innerHTML = '<p class="empty-state">Sección no disponible</p>';
      UIManager.showToast('Sección no disponible', 'warning');
    } catch (e) {
      console.error('Error al cargar pestaña:', e);
      UIManager.showToast('Error al cargar la sección', 'error');
    }
  }

  window.UIManager = UIManager;
  window.loadContent = loadContent;
})();