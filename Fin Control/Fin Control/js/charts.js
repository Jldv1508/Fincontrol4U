/**
 * charts.js - Visualización de datos financieros
 * Parte de la PWA de control financiero doméstico
 */

// Objeto principal para gestionar gráficos
const ChartsManager = {
    // Colores para usar en los gráficos
    colors: {
        income: '#4CAF50',
        expense: '#F44336',
        palette: [
            '#4CAF50', '#2196F3', '#FF9800', '#F44336', 
            '#9C27B0', '#3F51B5', '#009688', '#FFC107',
            '#795548', '#607D8B'
        ]
    },
    
    /**
     * Inicializa los gráficos en el dashboard
     */
    async initDashboardCharts() {
        try {
            await this.renderBalanceChart('balance-chart');
            await this.renderCategoryChart('category-chart');
            await this.renderTrendChart('trend-chart');
        } catch (error) {
            console.error('Error al inicializar gráficos:', error);
        }
    },
    
    /**
     * Renderiza el gráfico de balance (ingresos vs gastos)
     * @param {String} elementId - ID del elemento canvas
     */
    async renderBalanceChart(elementId) {
        try {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            // Obtener datos del mes actual
            const currentDate = new Date();
            const data = await TransactionsManager.getChartData('balance', {
                period: 'month',
                date: currentDate
            });
            
            if (!data) return;
            
            // Crear gráfico de tipo dona
            new Chart(element, {
                type: 'doughnut',
                data: {
                    labels: data.labels,
                    datasets: data.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: 'Balance del Mes'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error al renderizar gráfico de balance:', error);
        }
    },
    
    /**
     * Renderiza el gráfico de gastos por categoría
     * @param {String} elementId - ID del elemento canvas
     */
    async renderCategoryChart(elementId) {
        try {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            // Obtener datos del mes actual
            const currentDate = new Date();
            const data = await TransactionsManager.getChartData('category', {
                period: 'month',
                date: currentDate,
                transactionType: 'expense'
            });
            
            if (!data) return;
            
            // Crear gráfico de tipo pie
            new Chart(element, {
                type: 'pie',
                data: {
                    labels: data.labels,
                    datasets: data.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: 'Gastos por Categoría'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error al renderizar gráfico de categorías:', error);
        }
    },
    
    /**
     * Renderiza el gráfico de tendencia (ingresos y gastos a lo largo del tiempo)
     * @param {String} elementId - ID del elemento canvas
     */
    async renderTrendChart(elementId) {
        try {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            // Obtener datos de los últimos 6 meses
            const currentDate = new Date();
            const data = await TransactionsManager.getChartData('trend', {
                months: 6,
                date: currentDate
            });
            
            if (!data) return;
            
            // Crear gráfico de tipo línea
            new Chart(element, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: data.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: 'Tendencia de Ingresos y Gastos'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error al renderizar gráfico de tendencia:', error);
        }
    },
    
    /**
     * Renderiza un gráfico de previsión de gastos
     * @param {String} elementId - ID del elemento canvas
     * @param {Number} months - Número de meses a prever
     */
    async renderForecastChart(elementId, months = 3) {
        try {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            // Obtener datos históricos
            const currentDate = new Date();
            const historicalData = await TransactionsManager.getChartData('trend', {
                months: 6,
                date: currentDate
            });
            
            if (!historicalData) return;
            
            // Calcular previsión simple basada en promedios
            const incomeAvg = historicalData.datasets[0].data.reduce((a, b) => a + b, 0) / 
                              historicalData.datasets[0].data.length;
            const expenseAvg = historicalData.datasets[1].data.reduce((a, b) => a + b, 0) / 
                               historicalData.datasets[1].data.length;
            
            // Crear datos de previsión
            const labels = [...historicalData.labels];
            const incomeData = [...historicalData.datasets[0].data];
            const expenseData = [...historicalData.datasets[1].data];
            
            // Añadir meses de previsión
            for (let i = 0; i < months; i++) {
                const forecastDate = new Date(currentDate);
                forecastDate.setMonth(currentDate.getMonth() + i + 1);
                
                // Formato de etiqueta: "Ene", "Feb", etc.
                const monthName = forecastDate.toLocaleString('es', { month: 'short' });
                labels.push(monthName + '*');
                
                // Añadir valores de previsión con pequeña variación aleatoria
                const incomeVariation = (Math.random() * 0.2) - 0.1; // -10% a +10%
                const expenseVariation = (Math.random() * 0.2) - 0.1; // -10% a +10%
                
                incomeData.push(incomeAvg * (1 + incomeVariation));
                expenseData.push(expenseAvg * (1 + expenseVariation));
            }
            
            // Crear gráfico
            new Chart(element, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Ingresos',
                            data: incomeData,
                            borderColor: this.colors.income,
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            borderDash: function(context) {
                                // Línea punteada para datos de previsión
                                return context.dataIndex >= historicalData.labels.length ? [5, 5] : [];
                            }
                        },
                        {
                            label: 'Gastos',
                            data: expenseData,
                            borderColor: this.colors.expense,
                            backgroundColor: 'rgba(244, 67, 54, 0.1)',
                            borderDash: function(context) {
                                // Línea punteada para datos de previsión
                                return context.dataIndex >= historicalData.labels.length ? [5, 5] : [];
                            }
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: 'Previsión de Ingresos y Gastos'
                        },
                        tooltip: {
                            callbacks: {
                                footer: function(tooltipItems) {
                                    const dataIndex = tooltipItems[0].dataIndex;
                                    if (dataIndex >= historicalData.labels.length) {
                                        return 'Previsión basada en datos históricos';
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error al renderizar gráfico de previsión:', error);
        }
    }
};

// Exportar para uso en otros módulos
window.ChartsManager = ChartsManager;