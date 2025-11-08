// app.js - Bootstrap de la aplicación y registro de eventos
(function(){
  // Contexto global mínimo
  window.APP = window.APP || { db: null };
  // Formateo global de importes (es-ES), sin espacio antes del símbolo €
  if (typeof window.formatAmount !== 'function') {
    window.formatAmount = function(v){
      const num = Number(v) || 0;
      const s = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
      return s.replace(/\u00a0/g,'').replace(/\s*€/,'€');
    };
  }
  function setupNav() {
    const links = document.querySelectorAll('nav a');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        if (typeof window.loadContent === 'function') window.loadContent(tab);
      });
    });
  }

  function setupMenuToggle() {
    const btn = document.getElementById('menuToggle');
    const nav = document.getElementById('mainNav');
    if (btn && nav) {
      btn.addEventListener('click', () => {
        nav.classList.toggle('active');
      });
    }
  }

  function setupSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    setTimeout(() => { splash.style.display = 'none'; }, 800);
  }

  function setupInstallPrompt() {
    let deferredPrompt = null;
    const promptEl = document.getElementById('installPrompt');
    const installBtn = document.getElementById('installBtn');
    const closeBtn = document.getElementById('closeInstallPrompt');

    // Exponer API de instalación para usar desde un botón global
    window.PWAInstall = {
      available: false,
      prompt: async () => {
        if (!deferredPrompt) return false;
        const choice = await deferredPrompt.prompt();
        deferredPrompt = null;
        window.PWAInstall.available = false;
        if (promptEl) promptEl.style.display = 'none';
        return choice;
      }
    };

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      window.PWAInstall.available = true;
      if (promptEl) promptEl.style.display = 'flex';
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        const choice = await deferredPrompt.prompt();
        deferredPrompt = null;
        if (promptEl) promptEl.style.display = 'none';
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (promptEl) promptEl.style.display = 'none';
      });
    }

    const globalBtn = document.getElementById('installAppButton');
    if (globalBtn) {
      const tryInstall = async () => {
        if (!window.PWAInstall || !window.PWAInstall.available) {
          // Fallback: algunos navegadores ofrecen instalación desde el menú
          if (typeof window.showNotification === 'function') {
            showNotification('Usa el menú del navegador: Instalar aplicación', 'info');
          }
          return;
        }
        try { await window.PWAInstall.prompt(); } catch (_) {}
      };
      globalBtn.addEventListener('click', tryInstall);
    }

    window.addEventListener('appinstalled', () => {
      window.PWAInstall.available = false;
      if (promptEl) promptEl.style.display = 'none';
      if (typeof window.showNotification === 'function') {
        showNotification('Aplicación instalada correctamente', 'success');
      }
    });
  }

  async function initDB() {
    try {
      if (window.DB && typeof DB.init === 'function') {
        await DB.init();
      }
    } catch (e) {
      console.warn('No se pudo inicializar la BD:', e);
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
          .then((reg) => {
            console.log('Service Worker registrado');
            try { reg.update(); } catch(_) {}
            try {
              // Si cambia el controlador (nuevo SW activo), recargar para tomar contenido nuevo
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                try { window.location.reload(); } catch(_) {}
              });
            } catch(_) {}
          })
          .catch(err => console.log('Error al registrar Service Worker:', err));
      });
    }
  }

  async function init() {
    if (typeof window.initTheme === 'function') {
      try { initTheme(); } catch (_) {}
    }
    setupSplash();
    setupNav();
    setupMenuToggle();
    if (typeof window.setupThemeEvents === 'function') {
      try { setupThemeEvents(); } catch (_) {}
    }
    // Inicializar gestor de extractos bancarios si está disponible
    try {
      if (window.BankExtractManager && typeof window.BankExtractManager.init === 'function') {
        window.BankExtractManager.init();
      }
    } catch (e) { console.warn('No se pudo inicializar BankExtractManager:', e); }
    setupInstallPrompt();
    registerServiceWorker();
    await initDB();
    // Esperar brevemente a que los módulos de pestañas se registren (transacciones, análisis, etc.)
    try {
      await new Promise((resolve) => {
        let tries = 0;
        const check = () => {
          const ready = (
            typeof window.loadTransactions === 'function' ||
            typeof window.loadMonthlyAnalysis === 'function' ||
            typeof window.loadSubjectTab === 'function' ||
            typeof window.loadScanner === 'function'
          );
          if (ready || tries >= 5) { resolve(); return; }
          tries++;
          setTimeout(check, 200);
        };
        check();
      });
    } catch (_) {}
    if (typeof window.loadContent === 'function') window.loadContent('transactions');
    if (window.SyncManager && typeof SyncManager.init === 'function') {
      try { SyncManager.init(); } catch (_) {}
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();