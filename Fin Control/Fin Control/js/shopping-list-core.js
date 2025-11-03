/**
 * shopping-list-core.js - Módulo base para generar listas de compra con productos recurrentes
 */

const ShoppingListManager = {
    /**
     * Datos de listas de compra
     */
    shoppingListsDB: {
        lists: [],
        recurrentProducts: []
    },
    
    /**
     * Inicializa el módulo de listas de compra
     */
    init() {
        try {
            this.loadShoppingListsData();
            
            // Detectar productos recurrentes si hay datos suficientes
            if (window.ProductAnalysisManager && 
                window.ProductAnalysisManager.productDB && 
                window.ProductAnalysisManager.productDB.items && 
                window.ProductAnalysisManager.productDB.items.length > 0) {
                this.detectRecurrentProducts();
            }
            
            console.log('ShoppingListManager inicializado');
        } catch (error) {
            console.error('Error al inicializar ShoppingListManager:', error);
        }
    },
    
    /**
     * Carga los datos de listas de compra desde IndexedDB
     */
    async loadShoppingListsData() {
        try {
            // Cargar listas guardadas
            const savedLists = await getFromIndexedDB('shoppingLists');
            if (savedLists) {
                this.shoppingListsDB.lists = savedLists;
            }
            
            // Cargar productos recurrentes
            const recurrentProducts = await getFromIndexedDB('recurrentProducts');
            if (recurrentProducts) {
                this.shoppingListsDB.recurrentProducts = recurrentProducts;
            }
        } catch (error) {
            console.error('Error al cargar datos de listas de compra:', error);
        }
    },
    
    /**
     * Guarda los datos de listas de compra en IndexedDB
     */
    async saveShoppingListsData() {
        try {
            await saveToIndexedDB('shoppingLists', this.shoppingListsDB.lists);
            await saveToIndexedDB('recurrentProducts', this.shoppingListsDB.recurrentProducts);
        } catch (error) {
            console.error('Error al guardar datos de listas de compra:', error);
        }
    },
    
    /**
     * Detecta productos recurrentes basados en el historial de compras
     * @param {number} minOccurrences - Número mínimo de ocurrencias para considerar un producto recurrente
     * @param {number} maxDaysBetween - Número máximo de días entre compras para considerar recurrencia
     */
    detectRecurrentProducts(minOccurrences = 3, maxDaysBetween = 45) {
        try {
            if (!window.ProductAnalysisManager || 
                !window.ProductAnalysisManager.productDB || 
                !window.ProductAnalysisManager.productDB.items) {
                return;
            }
            
            const products = window.ProductAnalysisManager.productDB.items;
            const productOccurrences = {};
            
            // Agrupar productos por nombre normalizado
            products.forEach(product => {
                if (!product.normalizedName) return;
                
                if (!productOccurrences[product.normalizedName]) {
                    productOccurrences[product.normalizedName] = {
                        name: product.name,
                        normalizedName: product.normalizedName,
                        category: product.category,
                        occurrences: [],
                        averagePrice: 0,
                        totalSpent: 0,
                        recurrencePattern: null
                    };
                }
                
                // Añadir ocurrencia
                productOccurrences[product.normalizedName].occurrences.push({
                    date: new Date(product.receiptDate),
                    price: product.price,
                    store: product.store
                });
            });
            
            // Analizar patrones de recurrencia
            const recurrentProducts = [];
            
            for (const normalizedName in productOccurrences) {
                const product = productOccurrences[normalizedName];
                
                // Ordenar ocurrencias por fecha
                product.occurrences.sort((a, b) => a.date - b.date);
                
                // Verificar si hay suficientes ocurrencias
                if (product.occurrences.length >= minOccurrences) {
                    // Calcular días entre compras
                    const daysBetween = [];
                    for (let i = 1; i < product.occurrences.length; i++) {
                        const days = Math.round(
                            (product.occurrences[i].date - product.occurrences[i-1].date) / 
                            (1000 * 60 * 60 * 24)
                        );
                        daysBetween.push(days);
                    }
                    
                    // Calcular promedio de días entre compras
                    const avgDaysBetween = daysBetween.reduce((sum, days) => sum + days, 0) / daysBetween.length;
                    
                    // Calcular desviación estándar
                    const variance = daysBetween.reduce((sum, days) => sum + Math.pow(days - avgDaysBetween, 2), 0) / daysBetween.length;
                    const stdDev = Math.sqrt(variance);
                    
                    // Calcular precio promedio
                    const totalSpent = product.occurrences.reduce((sum, occ) => sum + occ.price, 0);
                    const averagePrice = totalSpent / product.occurrences.length;
                    
                    // Si el promedio de días es menor que el máximo y la desviación no es muy alta
                    if (avgDaysBetween <= maxDaysBetween && stdDev <= avgDaysBetween) {
                        // Determinar patrón de recurrencia
                        let pattern;
                        if (avgDaysBetween <= 10) {
                            pattern = 'weekly';
                        } else if (avgDaysBetween <= 20) {
                            pattern = 'biweekly';
                        } else {
                            pattern = 'monthly';
                        }
                        
                        // Calcular próxima fecha estimada de compra
                        const lastPurchase = product.occurrences[product.occurrences.length - 1].date;
                        const nextEstimatedDate = new Date(lastPurchase);
                        nextEstimatedDate.setDate(nextEstimatedDate.getDate() + Math.round(avgDaysBetween));
                        
                        // Añadir a productos recurrentes
                        recurrentProducts.push({
                            name: product.name,
                            normalizedName: product.normalizedName,
                            category: product.category,
                            occurrenceCount: product.occurrences.length,
                            averagePrice: averagePrice,
                            totalSpent: totalSpent,
                            recurrencePattern: pattern,
                            avgDaysBetween: avgDaysBetween,
                            lastPurchaseDate: lastPurchase,
                            nextEstimatedDate: nextEstimatedDate,
                            preferredStore: this.findPreferredStore(product.occurrences)
                        });
                    }
                }
            }
            
            // Actualizar lista de productos recurrentes
            this.shoppingListsDB.recurrentProducts = recurrentProducts;
            
            // Guardar en IndexedDB
            this.saveShoppingListsData();
            
            return recurrentProducts;
        } catch (error) {
            console.error('Error al detectar productos recurrentes:', error);
            return [];
        }
    },
    
    /**
     * Encuentra el establecimiento preferido para un producto
     * @param {Array} occurrences - Ocurrencias del producto
     * @returns {string} - Nombre del establecimiento preferido
     */
    findPreferredStore(occurrences) {
        const storeCount = {};
        
        // Contar ocurrencias por establecimiento
        occurrences.forEach(occ => {
            if (!occ.store) return;
            
            if (!storeCount[occ.store]) {
                storeCount[occ.store] = 0;
            }
            
            storeCount[occ.store]++;
        });
        
        // Encontrar el establecimiento con más ocurrencias
        let preferredStore = null;
        let maxCount = 0;
        
        for (const store in storeCount) {
            if (storeCount[store] > maxCount) {
                maxCount = storeCount[store];
                preferredStore = store;
            }
        }
        
        return preferredStore;
    },
    
    /**
     * Genera un UUID único
     * @returns {string} - UUID generado
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

// Exportar el módulo
window.ShoppingListManager = ShoppingListManager;