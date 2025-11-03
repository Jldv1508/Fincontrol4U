/**
 * theme.js - Gestión del tema oscuro/claro
 * Maneja la configuración y cambios de tema en la aplicación
 */

// Constantes para temas
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';
const THEME_STORAGE_KEY = 'app-theme-preference';

// Inicializar tema
function initTheme() {
    // Cargar preferencia guardada o usar preferencia del sistema
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Aplicar tema inicial
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(prefersDark ? THEME_DARK : THEME_LIGHT);
    }
    
    // Escuchar cambios en la preferencia del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        // Solo cambiar automáticamente si no hay preferencia guardada
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
        }
    });
}

// Aplicar tema
function applyTheme(theme) {
    // Actualizar atributo en el documento
    if (theme === THEME_DARK) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    
    // Actualizar controles de tema en la interfaz
    updateThemeControls(theme);
    
    // Actualizar colores de gráficos
    updateChartsTheme(theme);
}

// Cambiar tema
function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    
    // Guardar preferencia
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    
    // Aplicar nuevo tema
    applyTheme(newTheme);
    
    return newTheme;
}

// Obtener tema actual
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' 
        ? THEME_DARK 
        : THEME_LIGHT;
}

// Actualizar controles de tema en la interfaz
function updateThemeControls(theme) {
    // Actualizar toggle en la configuración
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = theme === THEME_DARK;
    }
    
    // Actualizar icono en el header
    const themeIcon = document.querySelector('.theme-toggle-icon');
    if (themeIcon) {
        if (theme === THEME_DARK) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }
}

// Actualizar colores de gráficos según el tema
function updateChartsTheme(theme) {
    // Definir colores según el tema
    let colors = {
        backgroundColor: '',
        borderColor: '',
        textColor: '',
        gridColor: ''
    };
    
    if (theme === THEME_DARK) {
        colors.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        colors.borderColor = 'rgba(255, 255, 255, 0.2)';
        colors.textColor = 'rgba(255, 255, 255, 0.8)';
        colors.gridColor = 'rgba(255, 255, 255, 0.1)';
    } else {
        colors.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        colors.borderColor = 'rgba(0, 0, 0, 0.1)';
        colors.textColor = 'rgba(0, 0, 0, 0.8)';
        colors.gridColor = 'rgba(0, 0, 0, 0.1)';
    }
    
    // Actualizar configuración global de Chart.js
    if (window.Chart) {
        Chart.defaults.color = colors.textColor;
        Chart.defaults.borderColor = colors.gridColor;
        
        // Actualizar gráficos existentes
        Chart.instances.forEach(chart => {
            // Actualizar opciones
            if (chart.options.scales && chart.options.scales.x) {
                chart.options.scales.x.grid.color = colors.gridColor;
                chart.options.scales.x.ticks.color = colors.textColor;
            }
            
            if (chart.options.scales && chart.options.scales.y) {
                chart.options.scales.y.grid.color = colors.gridColor;
                chart.options.scales.y.ticks.color = colors.textColor;
            }
            
            // Actualizar colores de leyenda
            if (chart.options.plugins && chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = colors.textColor;
            }
            
            // Actualizar el gráfico
            chart.update();
        });
    }
}

// Configurar eventos de tema
function setupThemeEvents() {
    // Botón de tema en el header
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const newTheme = toggleTheme();
            
            // Guardar en la base de datos si está disponible
            if (window.saveSettings) {
                saveSettings({ darkMode: newTheme === THEME_DARK })
                    .catch(error => console.error('Error al guardar preferencia de tema:', error));
            }
        });
    }
    
    // Toggle en la configuración
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? THEME_DARK : THEME_LIGHT;
            
            // Guardar preferencia
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
            
            // Aplicar nuevo tema
            applyTheme(newTheme);
            
            // Guardar en la base de datos si está disponible
            if (window.saveSettings) {
                saveSettings({ darkMode: newTheme === THEME_DARK })
                    .catch(error => console.error('Error al guardar preferencia de tema:', error));
            }
        });
    }
}

// Exportar funciones
window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
window.getCurrentTheme = getCurrentTheme;
window.updateChartsTheme = updateChartsTheme;
window.setupThemeEvents = setupThemeEvents;