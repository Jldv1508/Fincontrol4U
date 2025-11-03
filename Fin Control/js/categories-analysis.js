/**
 * categories-analysis.js - Análisis por categorías con filtro por miembro de familia
 */

async function loadCategoriesAnalysis() {
    const main = ensureMain();
    if (!main) return;
    
    main.innerHTML = `
        <section class="categories-analysis">
            <h2>Análisis por Categorías</h2>
            
            <div class="analysis-filters">
                <div class="filter-row">
                    <select id="member-filter" class="form-control">
                        <option value="">Todos los miembros</option>
                    </select>
                    <select id="period-filter" class="form-control">
                        <option value="current-month">Mes actual</option>
                        <option value="last-month">Mes anterior</option>
                        <option value="current-year">Año actual</option>
                        <option value="last-year">Año anterior</option>
                        <option value="all">Todo el período</option>
                    </select>
                    <button id="apply-filters" class="btn btn-primary">
                        <i class="fas fa-filter"></i> Aplicar filtros
                    </button>
                </div>
            </div>
            
            <div class="analysis-summary" id="analysis-summary">
                <div class="loading">Cargando análisis...</div>
            </div>
            
            <div class="categories-chart-container">
                <canvas id="categories-chart" width="400" height="200"></canvas>
            </div>
            
            <div class="categories-details" id="categories-details">
                <!-- Los detalles se cargarán aquí -->
            </div>
        </section>
    `;
    
    // Inicializar filtros
    initializeCategoryFilters();
    
    // Cargar análisis inicial
    await loadCategoryAnalysis();
}

function initializeCategoryFilters() {
    // Inicializar selector de miembros
    const memberFilter = document.getElementById('member-filter');
    if (memberFilter && typeof FamilyManager !== 'undefined') {
        const members = FamilyManager.getMembers();
        memberFilter.innerHTML = '<option value="">Todos los miembros</option>' + 
            members.filter(m => m !== 'Todos').map(member => 
                `<option value="${member}">${member}</option>`
            ).join('');
    }
    
    // Event listeners para filtros
    const applyButton = document.getElementById('apply-filters');
    if (applyButton) {
        applyButton.addEventListener('click', loadCategoryAnalysis);
    }
}

async function loadCategoryAnalysis() {
    const summaryContainer = document.getElementById('analysis-summary');
    const detailsContainer = document.getElementById('categories-details');
    
    if (!summaryContainer || !detailsContainer) return;
    
    try {
        // Obtener filtros
        const memberFilter = document.getElementById('member-filter')?.value || '';
        const periodFilter = document.getElementById('period-filter')?.value || 'current-month';
        
        // Obtener transacciones
        const allTransactions = await getAllTransactions();
        
        // Filtrar transacciones
        const filteredTransactions = filterTransactionsByPeriodAndMember(allTransactions, periodFilter, memberFilter);
        
        // Generar análisis
        const analysis = generateCategoryAnalysis(filteredTransactions);
        
        // Mostrar resumen
        summaryContainer.innerHTML = renderAnalysisSummary(analysis, memberFilter, periodFilter);
        
        // Mostrar detalles por categoría
        detailsContainer.innerHTML = renderCategoryDetails(analysis);
        
        // Actualizar gráfico
        updateCategoriesChart(analysis);
        
    } catch (error) {
        console.error('Error cargando análisis de categorías:', error);
        summaryContainer.innerHTML = '<p class="error">Error cargando el análisis</p>';
    }
}

function filterTransactionsByPeriodAndMember(transactions, period, member) {
    const now = new Date();
    let startDate, endDate;
    
    // Definir rango de fechas según el período
    switch (period) {
        case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'last-month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'last-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
            break;
        default:
            startDate = null;
            endDate = null;
    }
    
    return transactions.filter(tx => {
        // Filtrar por fecha
        if (startDate && endDate) {
            const txDate = new Date(tx.date);
            if (txDate < startDate || txDate > endDate) {
                return false;
            }
        }
        
        // Filtrar por miembro
        if (member && tx.member && tx.member !== member) {
            return false;
        }
        
        return true;
    });
}

function generateCategoryAnalysis(transactions) {
    const analysis = {
        totalIncome: 0,
        totalExpenses: 0,
        categories: {},
        transactionCount: transactions.length
    };
    
    transactions.forEach(tx => {
        const amount = Number(tx.amount) || 0;
        const category = tx.category || 'Sin categoría';
        const type = tx.type || tx.kind || 'expense';
        
        if (!analysis.categories[category]) {
            analysis.categories[category] = {
                income: 0,
                expenses: 0,
                transactions: []
            };
        }
        
        analysis.categories[category].transactions.push(tx);
        
        if (type === 'income') {
            analysis.categories[category].income += amount;
            analysis.totalIncome += amount;
        } else {
            analysis.categories[category].expenses += amount;
            analysis.totalExpenses += amount;
        }
    });
    
    // Ordenar categorías por gasto total
    const sortedCategories = Object.entries(analysis.categories)
        .sort(([,a], [,b]) => b.expenses - a.expenses);
    
    analysis.sortedCategories = sortedCategories;
    analysis.balance = analysis.totalIncome - analysis.totalExpenses;
    
    return analysis;
}

function renderAnalysisSummary(analysis, memberFilter, periodFilter) {
    const periodText = {
        'current-month': 'Mes actual',
        'last-month': 'Mes anterior', 
        'current-year': 'Año actual',
        'last-year': 'Año anterior',
        'all': 'Todo el período'
    }[periodFilter] || 'Período seleccionado';
    
    const memberText = memberFilter ? ` - ${memberFilter}` : ' - Todos los miembros';
    
    return `
        <div class="summary-cards">
            <div class="summary-card">
                <h3>Período</h3>
                <p>${periodText}${memberText}</p>
            </div>
            <div class="summary-card income">
                <h3>Ingresos</h3>
                <p class="amount">${formatAmount(analysis.totalIncome)}</p>
            </div>
            <div class="summary-card expense">
                <h3>Gastos</h3>
                <p class="amount">${formatAmount(analysis.totalExpenses)}</p>
            </div>
            <div class="summary-card ${analysis.balance >= 0 ? 'positive' : 'negative'}">
                <h3>Balance</h3>
                <p class="amount">${formatAmount(analysis.balance)}</p>
            </div>
            <div class="summary-card">
                <h3>Transacciones</h3>
                <p>${analysis.transactionCount}</p>
            </div>
        </div>
    `;
}

function renderCategoryDetails(analysis) {
    if (!analysis.sortedCategories.length) {
        return '<p class="empty-state">No hay datos para mostrar</p>';
    }
    
    return `
        <div class="category-details-list">
            <h3>Detalles por Categoría</h3>
            ${analysis.sortedCategories.map(([category, data]) => {
                const total = data.expenses + data.income;
                const expensePercentage = analysis.totalExpenses > 0 ? 
                    ((data.expenses / analysis.totalExpenses) * 100).toFixed(1) : 0;
                
                return `
                    <div class="category-detail-item">
                        <div class="category-header">
                            <h4>${category}</h4>
                            <div class="category-amounts">
                                ${data.income > 0 ? `<span class="income">+${formatAmount(data.income)}</span>` : ''}
                                ${data.expenses > 0 ? `<span class="expense">-${formatAmount(data.expenses)}</span>` : ''}
                                <span class="percentage">${expensePercentage}%</span>
                            </div>
                        </div>
                        <div class="category-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${expensePercentage}%"></div>
                            </div>
                        </div>
                        <div class="category-transactions">
                            <p>${data.transactions.length} transacciones</p>
                            <button class="btn btn-sm" onclick="toggleCategoryTransactions('${category}')">
                                <i class="fas fa-eye"></i> Ver detalles
                            </button>
                        </div>
                        <div class="category-transaction-list" id="transactions-${category.replace(/\s+/g, '-')}" style="display: none;">
                            ${data.transactions.slice(0, 5).map(tx => `
                                <div class="transaction-mini">
                                    <span class="tx-date">${new Date(tx.date).toLocaleDateString('es-ES')}</span>
                                    <span class="tx-desc">${tx.description || 'Sin descripción'}</span>
                                    <span class="tx-amount ${tx.type === 'expense' ? 'negative' : 'positive'}">
                                        ${tx.type === 'expense' ? '-' : '+'}${formatAmount(tx.amount)}
                                    </span>
                                    ${tx.member ? `<span class="tx-member">${tx.member}</span>` : ''}
                                </div>
                            `).join('')}
                            ${data.transactions.length > 5 ? `<p class="more-transactions">... y ${data.transactions.length - 5} más</p>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function toggleCategoryTransactions(category) {
    const elementId = 'transactions-' + category.replace(/\s+/g, '-');
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
}

function updateCategoriesChart(analysis) {
    const canvas = document.getElementById('categories-chart');
    if (!canvas || !window.Chart) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (window.categoriesChart) {
        window.categoriesChart.destroy();
    }
    
    // Preparar datos para el gráfico
    const topCategories = analysis.sortedCategories.slice(0, 8); // Top 8 categorías
    const labels = topCategories.map(([category]) => category);
    const data = topCategories.map(([, data]) => data.expenses);
    
    // Colores para el gráfico
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];
    
    window.categoriesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
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
}

// Función auxiliar para formatear cantidades (debe estar disponible globalmente)
function formatAmount(amount) {
    if (typeof window.formatAmount === 'function') {
        return window.formatAmount(amount);
    }
    return new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency: 'EUR' 
    }).format(amount || 0);
}

// Función auxiliar para obtener todas las transacciones
async function getAllTransactions() {
    if (typeof window.getAllTransactions === 'function') {
        return await window.getAllTransactions();
    }
    if (typeof DB !== 'undefined' && DB.getAll) {
        return await DB.getAll('transactions');
    }
    return [];
}

// Función auxiliar para asegurar que existe el contenedor principal
function ensureMain() {
    if (typeof window.ensureMain === 'function') {
        return window.ensureMain();
    }
    return document.getElementById('mainContent');
}

// Exponer funciones globalmente
window.loadCategoriesAnalysis = loadCategoriesAnalysis;
window.toggleCategoryTransactions = toggleCategoryTransactions;