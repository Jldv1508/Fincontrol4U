/**
 * price-comparison.js - Módulo para comparación de precios entre establecimientos
 */

const PriceComparisonManager = {
    /**
     * Compara precios de un producto entre diferentes establecimientos
     * @param {string} productName - Nombre del producto
     * @param {Array} products - Lista de productos (opcional)
     * @returns {Array} - Comparativa de precios
     */
    compareProductPrices(productName, products = null) {
        try {
            // Si no se proporcionan productos, usar los del ProductAnalysisManager
            const allProducts = products || (window.ProductAnalysisManager ? 
                window.ProductAnalysisManager.productDB.items : []);
            
            if (!allProducts || allProducts.length === 0) {
                return [];
            }
            
            const normalizedName = this.normalizeProductName(productName);
            const comparison = [];
            
            // Buscar todos los productos con ese nombre normalizado
            const matchingProducts = allProducts.filter(
                p => p.normalizedName === normalizedName
            );
            
            if (matchingProducts.length === 0) return [];
            
            // Agrupar por establecimiento
            const storeGroups = {};
            
            matchingProducts.forEach(product => {
                if (!storeGroups[product.store]) {
                    storeGroups[product.store] = {
                        store: product.store,
                        prices: [],
                        latestPrice: null,
                        averagePrice: 0
                    };
                }
                
                storeGroups[product.store].prices.push({
                    price: product.price,
                    date: product.receiptDate
                });
            });
            
            // Calcular estadísticas por establecimiento
            for (const store in storeGroups) {
                const group = storeGroups[store];
                
                // Ordenar precios por fecha
                group.prices.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Precio más reciente
                group.latestPrice = group.prices[0].price;
                
                // Precio promedio
                const sum = group.prices.reduce((total, item) => total + item.price, 0);
                group.averagePrice = sum / group.prices.length;
                
                comparison.push({
                    store: group.store,
                    latestPrice: group.latestPrice,
                    averagePrice: group.averagePrice,
                    priceCount: group.prices.length,
                    priceHistory: group.prices
                });
            }
            
            // Ordenar por precio más bajo
            comparison.sort((a, b) => a.latestPrice - b.latestPrice);
            
            return comparison;
        } catch (error) {
            console.error('Error al comparar precios:', error);
            return [];
        }
    },
    
    /**
     * Normaliza el nombre de un producto para facilitar comparaciones
     * @param {string} name - Nombre del producto
     * @returns {string} - Nombre normalizado
     */
    normalizeProductName(name) {
        return name
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '')
            .trim();
    },
    
    /**
     * Muestra la interfaz de comparación de precios
     * @param {string} initialProduct - Producto inicial a buscar (opcional)
     */
    showComparisonInterface(initialProduct = null) {
        // Crear contenido para la comparación
        const content = `
            <div class="price-comparison-container">
                <h3>Comparación de precios por establecimiento</h3>
                <div class="search-container">
                    <input type="text" id="product-search" class="form-control" 
                        placeholder="Buscar producto..." value="${initialProduct || ''}">
                    <button id="search-btn" class="btn btn-primary">Buscar</button>
                </div>
                <div id="comparison-results" class="comparison-results">
                    <p>Busca un producto para ver la comparación de precios entre establecimientos.</p>
                </div>
            </div>
        `;
        
        // Mostrar en un modal
        showModal({
            title: 'Comparación de precios',
            content,
            size: 'medium',
            onOpen: () => {
                this.setupComparisonEvents();
                
                // Si hay un producto inicial, realizar la búsqueda
                if (initialProduct) {
                    this.showProductComparison(initialProduct);
                }
            }
        });
    },
    
    /**
     * Configura los eventos para la interfaz de comparación
     */
    setupComparisonEvents() {
        // Búsqueda de productos
        document.getElementById('search-btn').addEventListener('click', () => {
            const searchTerm = document.getElementById('product-search').value.trim();
            if (searchTerm) {
                this.showProductComparison(searchTerm);
            }
        });
        
        // Búsqueda con Enter
        document.getElementById('product-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = e.target.value.trim();
                if (searchTerm) {
                    this.showProductComparison(searchTerm);
                }
            }
        });
    },
    
    /**
     * Muestra la comparación de precios para un producto
     * @param {string} productName - Nombre del producto
     */
    showProductComparison(productName) {
        const comparison = this.compareProductPrices(productName);
        const resultsContainer = document.getElementById('comparison-results');
        
        if (comparison.length === 0) {
            resultsContainer.innerHTML = `<p>No se encontraron datos para "${productName}".</p>`;
            return;
        }
        
        // Crear tabla de comparación
        let html = `
            <h4>Resultados para "${productName}"</h4>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Establecimiento</th>
                        <th>Precio actual</th>
                        <th>Precio promedio</th>
                        <th>Diferencia</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Calcular el precio más bajo como referencia
        const lowestPrice = comparison[0].latestPrice;
        
        comparison.forEach(store => {
            const difference = ((store.latestPrice - lowestPrice) / lowestPrice * 100).toFixed(1);
            const differenceClass = store.latestPrice === lowestPrice ? 'best-price' : '';
            
            html += `
                <tr>
                    <td>${store.store}</td>
                    <td>${window.formatAmount(store.latestPrice)}</td>
                    <td>${window.formatAmount(store.averagePrice)}</td>
                    <td class="${differenceClass}">
                        ${store.latestPrice === lowestPrice ? 'Mejor precio' : `+${difference}%`}
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
            <div class="price-history-chart">
                <h4>Historial de precios</h4>
                <canvas id="price-history-chart"></canvas>
            </div>
        `;
        
        resultsContainer.innerHTML = html;
        
        // Crear gráfico de historial de precios
        this.createPriceHistoryChart(comparison, productName);
    },
    
    /**
     * Crea un gráfico con el historial de precios
     * @param {Array} comparison - Datos de comparación
     * @param {string} productName - Nombre del producto
     */
    createPriceHistoryChart(comparison, productName) {
        const ctx = document.getElementById('price-history-chart').getContext('2d');
        
        // Preparar datos para el gráfico
        const datasets = [];
        const colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b'];
        
        comparison.forEach((store, index) => {
            // Ordenar historial por fecha
            const history = [...store.priceHistory].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            datasets.push({
                label: store.store,
                data: history.map(item => ({
                    x: new Date(item.date),
                    y: item.price
                })),
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                tension: 0.1
            });
        });
        
        // Crear gráfico
        if (window.priceHistoryChart) {
            window.priceHistoryChart.destroy();
        }
        
        window.priceHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Evolución de precios: ${productName}`
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Fecha'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Precio (€)'
                        },
                        min: 0
                    }
                }
            }
        });
    },
    
    /**
     * Encuentra el establecimiento más barato para una lista de productos
     * @param {Array} productNames - Lista de nombres de productos
     * @returns {Object} - Mejor establecimiento y detalles
     */
    findBestStoreForProducts(productNames) {
        try {
            if (!productNames || productNames.length === 0) {
                return null;
            }
            
            const storeScores = {};
            const productResults = {};
            
            // Para cada producto, obtener comparación de precios
            productNames.forEach(productName => {
                const comparison = this.compareProductPrices(productName);
                
                if (comparison.length > 0) {
                    productResults[productName] = comparison;
                    
                    // Puntuar establecimientos (menor precio = mejor puntuación)
                    comparison.forEach((store, index) => {
                        if (!storeScores[store.store]) {
                            storeScores[store.store] = {
                                store: store.store,
                                score: 0,
                                productCount: 0,
                                totalPrice: 0
                            };
                        }
                        
                        // Dar puntos inversamente proporcionales a la posición en el ranking
                        // (1er lugar = n puntos, 2º lugar = n-1 puntos, etc.)
                        storeScores[store.store].score += comparison.length - index;
                        storeScores[store.store].productCount++;
                        storeScores[store.store].totalPrice += store.latestPrice;
                    });
                }
            });
            
            // Convertir a array y ordenar por puntuación
            const rankedStores = Object.values(storeScores)
                .filter(store => store.productCount > 0)
                .map(store => ({
                    ...store,
                    // Normalizar puntuación por número de productos encontrados
                    normalizedScore: store.productCount > 0 ? 
                        store.score / store.productCount : 0,
                    averagePrice: store.productCount > 0 ? 
                        store.totalPrice / store.productCount : 0
                }))
                .sort((a, b) => b.normalizedScore - a.normalizedScore);
            
            if (rankedStores.length === 0) {
                return null;
            }
            
            // Devolver el mejor establecimiento y detalles
            return {
                bestStore: rankedStores[0],
                allStores: rankedStores,
                productDetails: productResults
            };
        } catch (error) {
            console.error('Error al encontrar mejor establecimiento:', error);
            return null;
        }
    },
    
    /**
     * Muestra la interfaz de mejor establecimiento para una lista de productos
     * @param {Array} productNames - Lista de nombres de productos
     */
    showBestStoreInterface(productNames) {
        const result = this.findBestStoreForProducts(productNames);
        
        if (!result) {
            showNotification('error', 'No se encontraron datos suficientes para los productos seleccionados');
            return;
        }
        
        // Crear contenido
        let content = `
            <div class="best-store-container">
                <div class="best-store-result">
                    <h3>Mejor establecimiento para tu compra</h3>
                    <div class="best-store-card">
                        <h4>${result.bestStore.store}</h4>
                        <p>Este establecimiento ofrece los mejores precios para tu lista de productos.</p>
                        <div class="store-stats">
                            <div class="stat">
                                <span class="stat-label">Productos encontrados:</span>
                                <span class="stat-value">${result.bestStore.productCount} de ${productNames.length}</span>
                            </div>
                            <div class="stat">
                                <span class="stat-label">Precio promedio:</span>
                                <span class="stat-value">${window.formatAmount(result.bestStore.averagePrice)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <h4>Comparativa de establecimientos</h4>
                <table class="stores-table">
                    <thead>
                        <tr>
                            <th>Establecimiento</th>
                            <th>Productos encontrados</th>
                            <th>Precio total</th>
                            <th>Puntuación</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        result.allStores.forEach(store => {
            content += `
                <tr>
                    <td>${store.store}</td>
                    <td>${store.productCount} de ${productNames.length}</td>
                    <td>${window.formatAmount(store.totalPrice)}</td>
                    <td>${store.normalizedScore.toFixed(1)}</td>
                </tr>
            `;
        });
        
        content += `
                    </tbody>
                </table>
                
                <h4>Detalles por producto</h4>
                <div class="product-details">
        `;
        
        for (const productName in result.productDetails) {
            const comparison = result.productDetails[productName];
            
            content += `
                <div class="product-detail-card">
                    <h5>${productName}</h5>
                    <table class="product-detail-table">
                        <thead>
                            <tr>
                                <th>Establecimiento</th>
                                <th>Precio</th>
                                <th>Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // Calcular el precio más bajo como referencia
            const lowestPrice = comparison[0].latestPrice;
            
            comparison.forEach(store => {
                const difference = ((store.latestPrice - lowestPrice) / lowestPrice * 100).toFixed(1);
                const differenceClass = store.latestPrice === lowestPrice ? 'best-price' : '';
                
                content += `
                    <tr>
                        <td>${store.store}</td>
                        <td>${window.formatAmount(store.latestPrice)}</td>
                        <td class="${differenceClass}">
                            ${store.latestPrice === lowestPrice ? 'Mejor precio' : `+${difference}%`}
                        </td>
                    </tr>
                `;
            });
            
            content += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        content += `
                </div>
            </div>
        `;
        
        // Mostrar en un modal
        showModal({
            title: 'Análisis de mejor establecimiento',
            content,
            size: 'large'
        });
    }
};

// Exportar el módulo
window.PriceComparisonManager = PriceComparisonManager;