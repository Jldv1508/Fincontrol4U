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

  // Exponer helper global para módulos que lo usan
  if (typeof window !== 'undefined') {
    window.ensureMain = ensureMain;
  }

  // Utilidad interna: cargar un script una sola vez
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(true); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  // Fallback mensual sin await: calcula ingresos/gastos por mes y renderiza tabla
  function renderFallbackMonthly() {
    const main = ensureMain();
    if (!main) return;
    main.innerHTML = '<section class="loading"><p>Cargando análisis (fallback)...</p></section>';
    const getAll = (typeof window.getAllTransactions === 'function')
      ? Promise.resolve().then(() => window.getAllTransactions())
      : (typeof window.DB !== 'undefined' && typeof DB.getAll === 'function')
        ? DB.getAll('transactions')
        : Promise.resolve([]);
    getAll.then((all) => {
      const byMonth = {};
      (all||[]).forEach((t) => {
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        byMonth[key] = byMonth[key] || { income: 0, expense: 0 };
        const amt = Number(t.amount)||0;
        const type = (t.type||t.kind) === 'income' ? 'income' : 'expense';
        byMonth[key][type] += amt;
      });
      const keys = Object.keys(byMonth).sort();
      const rows = keys.map(k => {
        const inc = byMonth[k].income;
        const exp = byMonth[k].expense;
        const bal = inc - exp;
        return `<tr><td>${k}</td><td>${inc.toFixed(2)}</td><td>${exp.toFixed(2)}</td><td>${bal.toFixed(2)}</td></tr>`;
      }).join('');
      main.innerHTML = `
        <section class="monthly-analysis">
          <div class="analysis-toolbar"><h2><i class="fas fa-chart-bar"></i> Análisis (fallback)</h2></div>
          <div class="monthly-table-wrap">
            <table class="table"><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table>
          </div>
        </section>`;
    }).catch((e) => {
      console.error('Fallback mensual: error al obtener transacciones', e);
      if (main) main.innerHTML = '<p class="empty-state">Sección no disponible</p>';
      UIManager.showToast('Sección no disponible', 'warning');
    });
  }

  // Si la vista no aparece en un tiempo razonable, forzar fallback
  function scheduleFallbackCheck(timeoutMs = 1500) {
    const timerId = setTimeout(() => {
      const exists = document.querySelector('.monthly-analysis') || document.querySelector('.categories-analysis');
      if (!exists) {
        renderFallbackMonthly();
      }
    }, timeoutMs);
    return () => { try { clearTimeout(timerId); } catch(_) {} };
  }

  function loadContent(tab) {
    const t = (tab || 'transactions').toLowerCase();
    try {
      // Feedback visual inmediato al cambiar de pestaña
      const main = ensureMain();
      if (main) {
        if (t === 'analysis' || t === 'analysis-categories' || t === 'analysis-monthly' || t === 'analysis-subjects') {
          main.innerHTML = '<section class="loading"><p>Cargando análisis...</p></section>';
        } else if (t === 'transactions') {
          main.innerHTML = '<section class="loading"><p>Cargando transacciones...</p></section>';
        }
      }
      switch (t) {
        case 'transactions':
          if (typeof window.loadTransactions === 'function') {
            try { return window.loadTransactions(); } catch (e) {
              console.error('Error cargando Transacciones:', e);
              if (main) main.innerHTML = '<p class="empty-state">Error cargando Transacciones</p>';
              UIManager.showToast('Error al cargar Transacciones', 'error');
              return;
            }
          }
          break;
        
        case 'financing':
          if (typeof window.loadFinancing === 'function') return window.loadFinancing();
          break;
        case 'subject':
          if (typeof window.loadSubjectTab === 'function') return window.loadSubjectTab();
          break;
        case 'analysis-categories':
          // Programar fallback si no aparece vista en breve
          const cancelFallbackA = scheduleFallbackCheck(1500);
          if (typeof window.loadCategoriesAnalysis === 'function') {
            try { return window.loadCategoriesAnalysis(); } catch (e) {
              console.warn('Fallo en Análisis Categorías, intentando mensual:', e);
              if (typeof window.loadMonthlyAnalysis === 'function') {
                try { return window.loadMonthlyAnalysis(); } catch (e2) {
                  console.error('Error cargando Análisis Mensual:', e2);
                  if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Categorías</p>';
                  UIManager.showToast('Error al cargar Análisis Categorías', 'error');
                  return;
                }
              } else {
                // Intentar cargar dinámicamente el módulo mensual y reintentar
                UIManager.showToast('Cargando módulo de Análisis Mensual...', 'info');
                loadScriptOnce('js/monthly-analysis.js')
                  .then(() => {
                    if (typeof window.loadMonthlyAnalysis === 'function') {
                      try { window.loadMonthlyAnalysis(); return; } catch (e3) {
                        console.error('Error cargando Análisis Mensual tras inyección:', e3);
                        if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Categorías</p>';
                        UIManager.showToast('Error al cargar Análisis Categorías', 'error');
                        return;
                      }
                    }
                    // Usar fallback si el módulo no expone el loader
                    cancelFallbackA(); renderFallbackMonthly();
                  })
                  .catch((injErr) => {
                    console.warn('No se pudo inyectar monthly-analysis.js:', injErr);
                    cancelFallbackA(); renderFallbackMonthly();
                  });
                return;
              }
            }
          }
          if (typeof window.loadMonthlyAnalysis === 'function') {
            try { cancelFallbackA(); return window.loadMonthlyAnalysis(); } catch (e3) {
              console.error('Error cargando Análisis Mensual:', e3);
              if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Categorías</p>';
              UIManager.showToast('Error al cargar Análisis Categorías', 'error');
              return;
            }
          }
          // Si no hay módulos, intentar cargarlos dinámicamente y reintentar categorías primero
          UIManager.showToast('Cargando módulo de Análisis Categorías...', 'info');
          loadScriptOnce('js/categories-analysis.js')
            .then(() => {
              if (typeof window.loadCategoriesAnalysis === 'function') {
                try { cancelFallbackA(); window.loadCategoriesAnalysis(); return; } catch (e4) {
                  console.warn('Fallo tras inyección en Categorías, intentando mensual:', e4);
                }
              }
              return loadScriptOnce('js/monthly-analysis.js');
            })
            .then(() => {
              if (typeof window.loadMonthlyAnalysis === 'function') {
                try { cancelFallbackA(); window.loadMonthlyAnalysis(); return; } catch (e5) {}
              }
              cancelFallbackA(); renderFallbackMonthly();
            })
            .catch((errInj) => {
              console.warn('No se pudieron inyectar módulos de análisis:', errInj);
              cancelFallbackA(); renderFallbackMonthly();
            });
          return;
          break;
        case 'analysis-monthly':
          // Análisis Mensual: cargar directamente el análisis mensual
          const cancelFallbackA2 = scheduleFallbackCheck(1500);
          if (typeof window.loadMonthlyAnalysis === 'function') {
            try { cancelFallbackA2(); return window.loadMonthlyAnalysis(); } catch (e4) {
              console.error('Error cargando Análisis Mensual:', e4);
              if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Mensual</p>';
              UIManager.showToast('Error al cargar Análisis Mensual', 'error');
              return;
            }
          }
          // Intentar inyectar el módulo mensual si no está
          UIManager.showToast('Cargando módulo de Análisis Mensual...', 'info');
          loadScriptOnce('js/monthly-analysis.js')
            .then(() => {
              if (typeof window.loadMonthlyAnalysis === 'function') {
                try { cancelFallbackA2(); window.loadMonthlyAnalysis(); return; } catch (e6) {
                  console.error('Error cargando Análisis Mensual tras inyección:', e6);
                  if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Mensual</p>';
                  UIManager.showToast('Error al cargar Análisis Mensual', 'error');
                  return;
                }
              }
              cancelFallbackA2(); renderFallbackMonthly();
            })
            .catch((injErr2) => {
              console.warn('No se pudo inyectar monthly-analysis.js para Análisis Mensual:', injErr2);
              cancelFallbackA2(); renderFallbackMonthly();
            });
          return;
          break;
        case 'analysis-subjects':
          // Análisis por sujetos: cargar módulo y fallback mensual si fuese necesario
          const cancelFallbackS = scheduleFallbackCheck(1500);
          if (typeof window.loadSubjectsAnalysis === 'function') {
            try { cancelFallbackS(); return window.loadSubjectsAnalysis(); } catch (eS) {
              console.error('Error cargando Análisis Sujetos:', eS);
              if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Sujetos</p>';
              UIManager.showToast('Error al cargar Análisis Sujetos', 'error');
              return;
            }
          }
          UIManager.showToast('Cargando módulo de Análisis Sujetos...', 'info');
          loadScriptOnce('js/subjects-analysis.js')
            .then(() => {
              if (typeof window.loadSubjectsAnalysis === 'function') {
                try { cancelFallbackS(); window.loadSubjectsAnalysis(); return; } catch (eS2) {
                  console.error('Error cargando Análisis Sujetos tras inyección:', eS2);
                  if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis Sujetos</p>';
                  UIManager.showToast('Error al cargar Análisis Sujetos', 'error');
                  return;
                }
              }
              cancelFallbackS(); renderFallbackMonthly();
            })
            .catch((injErrS) => {
              console.warn('No se pudo inyectar subjects-analysis.js:', injErrS);
              cancelFallbackS(); renderFallbackMonthly();
            });
          return;
          break;
        case 'analysis':
          // Nueva pestaña de análisis simple
          if (typeof window.loadAnalysis === 'function') {
            try { return window.loadAnalysis(); } catch (eA) {
              console.error('Error cargando Análisis:', eA);
              if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis</p>';
              UIManager.showToast('Error al cargar Análisis', 'error');
              return;
            }
          }
          // Intentar inyectar el módulo si no está presente
          UIManager.showToast('Cargando módulo de Análisis...', 'info');
          loadScriptOnce('js/analysis.js')
            .then(() => {
              if (typeof window.loadAnalysis === 'function') {
                try { window.loadAnalysis(); return; } catch (eA2) {
                  console.error('Error cargando Análisis tras inyección:', eA2);
                  if (main) main.innerHTML = '<p class="empty-state">Error cargando Análisis</p>';
                  UIManager.showToast('Error al cargar Análisis', 'error');
                  return;
                }
              }
              if (main) main.innerHTML = '<p class="empty-state">Sección no disponible</p>';
            })
            .catch((injErrA) => {
              console.warn('No se pudo inyectar analysis.js:', injErrA);
              if (main) main.innerHTML = '<p class="empty-state">Sección no disponible</p>';
            });
          return;
          break;
        case 'scanner':
          if (typeof window.loadScanner === 'function') return window.loadScanner();
          break;
        case 'forecast':
          if (typeof window.loadForecast === 'function') return window.loadForecast();
          break;
        case 'settings':
          if (typeof window.loadSettings === 'function') return window.loadSettings();
          break;
      }
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