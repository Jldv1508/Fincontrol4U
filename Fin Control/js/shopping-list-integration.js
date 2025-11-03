/**
 * shopping-list-integration.js - Integración del módulo de listas de compra
 */

const ShoppingListIntegration = {
    /**
     * Inicializa la integración del módulo de listas de compra
     */
    init: function() {
        // Asegurar que la base de datos tenga el almacén necesario
        this.setupDatabase();
        
        // Añadir botón al menú si no existe
        this.addMenuButton();
        
        // Inicializar módulos relacionados
        this.initializeModules();
    },
    
    /**
     * Configura la base de datos para soportar listas de compra
     */
    setupDatabase: function() {
        const request = indexedDB.open('finanzasPersonalesDB', 1);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Crear almacenes de objetos si no existen
            if (!db.objectStoreNames.contains('productData')) {
                db.createObjectStore('productData', { keyPath: 'id' });
                console.log('Almacén productData creado');
            }
            
            if (!db.objectStoreNames.contains('shoppingLists')) {
                db.createObjectStore('shoppingLists', { keyPath: 'id' });
                console.log('Almacén shoppingLists creado');
            }
        };
        
        request.onsuccess = function() {
            console.log('Base de datos configurada para listas de compra');
        };
        
        request.onerror = function(event) {
            console.error('Error al configurar la base de datos:', event.target.error);
        };
    },
    
    /**
     * Añade el botón de listas de compra al menú principal
     */
    addMenuButton: function() {
        // Verificar si ya existe el botón
        if (document.getElementById('shopping-list-btn')) {
            return;
        }
        
        // Encontrar el contenedor del menú
        const menuContainer = document.querySelector('.sidebar-menu') || document.querySelector('.app-menu');
        
        if (!menuContainer) {
            console.error('No se encontró el contenedor del menú');
            return;
        }
        
        // Crear el botón
        const menuItem = document.createElement('li');
        menuItem.className = 'menu-item';
        menuItem.innerHTML = `
            <button id="shopping-list-btn" class="menu-btn">
                <i class="fas fa-shopping-basket"></i>
                <span>Listas de compra</span>
            </button>
        `;
        
        // Añadir al menú
        menuContainer.appendChild(menuItem);
        
        // Añadir evento al botón
        document.getElementById('shopping-list-btn').addEventListener('click', function() {
            if (window.ShoppingListUI) {
                ShoppingListUI.showShoppingListsInterface();
            } else if (window.ShoppingListManager) {
                ShoppingListManager.loadUIModule().then(() => {
                    ShoppingListUI.showShoppingListsInterface();
                });
            } else {
                console.error('Módulo de listas de compra no disponible');
                
                // Mostrar mensaje al usuario
                if (window.NotificationManager) {
                    NotificationManager.show({
                        type: 'error',
                        message: 'El módulo de listas de compra no está disponible'
                    });
                }
            }
        });
    },
    
    /**
     * Inicializa los módulos relacionados con las listas de compra
     */
    initializeModules: function() {
        // Cargar scripts necesarios si no están ya cargados
        this.loadScript('/js/product-extractor.js')
            .then(() => this.loadScript('/js/price-comparison.js'))
            .then(() => this.loadScript('/js/shopping-list-core.js'))
            .then(() => {
                // Inicializar módulos
                if (window.ProductExtractor && !ProductExtractor.initialized) {
                    ProductExtractor.init();
                }
                
                if (window.PriceComparisonManager && !PriceComparisonManager.initialized) {
                    PriceComparisonManager.init();
                }
                
                if (window.ShoppingListManager && !ShoppingListManager.initialized) {
                    ShoppingListManager.init();
                }
                
                console.log('Módulos de listas de compra inicializados');
            })
            .catch(error => {
                console.error('Error al cargar los módulos de listas de compra:', error);
            });
            
        // Cargar estilos CSS
        this.loadCSS('/css/price-comparison.css');
        this.loadCSS('/css/shopping-list.css');
    },
    
    /**
     * Carga un script de forma dinámica
     * @param {string} src - Ruta del script
     * @returns {Promise} - Promesa que se resuelve cuando el script se ha cargado
     */
    loadScript: function(src) {
        return new Promise((resolve, reject) => {
            // Verificar si el script ya está cargado
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
    
    /**
     * Carga un archivo CSS de forma dinámica
     * @param {string} href - Ruta del archivo CSS
     */
    loadCSS: function(href) {
        // Verificar si el CSS ya está cargado
        if (document.querySelector(`link[href="${href}"]`)) {
            return;
        }
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    ShoppingListIntegration.init();
});