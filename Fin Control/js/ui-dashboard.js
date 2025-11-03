/**
 * ui-dashboard.js - Funciones específicas para el dashboard
 * Maneja la carga y visualización de datos en el dashboard
 */

// Cargar Dashboard
function loadDashboard() {
    const mainContent = document.getElementById('mainContent');
    
    mainContent.innerHTML = `
        <div class="dashboard">
            <h1 class="page-title">Dashboard</h1>
            
            <div class="summary-cards">
                <div class="card summary-card">
                    <div class="card-icon income">
                        <i class="fas fa-arrow-down"></i>
                    </div>
                    <div class="card-content">
                        <h3>Ingresos</h3>
                        <p class="amount" id="totalIncome">€0.00</p>
                        <p class="period">Este mes</p>
                    </div>
                </div>
                
                <div class="card summary-card">
                    <div class="card-icon expense">
                        <i class="fas fa-arrow-up"></i>
                    </div>
                    <div class="card-content">
                        <h3>Gastos</h3>
                        <p class="amount" id="totalExpense">€0.00</p>
                        <p class="period">Este mes</p>
                    </div>
                </div>
                
                <div class="card summary-card">
                    <div class="card-icon balance">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="card-content">
                        <h3>Balance</h3>
                        <p class="amount" id="totalBalance">€0.00</p>
                        <p class="period">Este mes</p>
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="card chart-card">
                    <h3>Balance de Ingresos y Gastos</h3>
                    <div class="chart-wrapper">
                        <canvas id="balanceChart"></canvas>
                    </div>
                </div>
                
                <div class="card chart-card">
                    <h3>Gastos por Categoría</h3>
                    <div class="chart-wrapper">
                        <canvas id="categoryChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card recent-transactions">
                <div class="card-header">
                    <h3>Transacciones Recientes</h3>
                    <a href="#" class="view-all" data-tab="transactions">Ver todas</a>
                </div>
                <div class="transaction-list" id="recentTransactionsList">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Inicializar datos del dashboard
    initDashboardData();
    
    // Configurar evento para "Ver todas"
    document.querySelector('.view-all').addEventListener('click', (e) => {
        e.preventDefault();
        loadContent('transactions');
        
        // Actualizar navegación
        document.querySelectorAll('nav a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-tab') === 'transactions') {
                link.classList.add('active');
            }
        });
    });
}

// Inicializar datos del dashboard
async function initDashboardData() {
    try {
        // Cargar transacciones recientes
        const recentTransactions = await getRecentTransactions(5);
        displayRecentTransactions(recentTransactions);
        
        // Cargar resumen financiero del mes actual
        const currentDate = new Date();
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        const summary = await getTransactionsSummary(firstDay, lastDay);
        
        // Actualizar tarjetas de resumen
        document.getElementById('totalIncome').textContent = `€${summary.totalIncome.toFixed(2)}`;
        document.getElementById('totalExpense').textContent = `€${summary.totalExpense.toFixed(2)}`;
        document.getElementById('totalBalance').textContent = `€${(summary.totalIncome - summary.totalExpense).toFixed(2)}`;
        
        // Inicializar gráficos
        initDashboardCharts(summary);
        
    } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
        showNotification('Error al cargar datos', 'error');
    }
}

// Mostrar transacciones recientes
function displayRecentTransactions(transactions) {
    const transactionsList = document.getElementById('recentTransactionsList');
    
    if (!transactions || transactions.length === 0) {
        transactionsList.innerHTML = '<p class="empty-state">No hay transacciones recientes</p>';
        return;
    }
    
    let html = '';
    
    transactions.forEach(transaction => {
        const isExpense = transaction.type === 'expense';
        const amountClass = isExpense ? 'expense-amount' : 'income-amount';
        const amountPrefix = isExpense ? '-' : '+';
        const icon = getCategoryIcon(transaction.category);
        
        html += `
            <div class="transaction-item" data-id="${transaction.id}">
                <div class="transaction-icon ${transaction.category}">
                    <i class="${icon}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${transaction.description}</h4>
                    <p>${formatDate(new Date(transaction.date))}</p>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountPrefix}€${transaction.amount.toFixed(2)}
                </div>
            </div>
        `;
    });
    
    transactionsList.innerHTML = html;
    
    // Añadir evento para ver detalles de transacción
    document.querySelectorAll('.transaction-item').forEach(item => {
        item.addEventListener('click', () => {
            const transactionId = item.getAttribute('data-id');
            showTransactionDetails(transactionId);
        });
    });
}

// Inicializar gráficos del dashboard
function initDashboardCharts(summary) {
    // Gráfico de balance
    const balanceCtx = document.getElementById('balanceChart').getContext('2d');
    window.balanceChart = new Chart(balanceCtx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                label: 'Importe (€)',
                data: [summary.totalIncome, summary.totalExpense],
                backgroundColor: [
                    'rgba(76, 201, 240, 0.7)',
                    'rgba(247, 37, 133, 0.7)'
                ],
                borderColor: [
                    'rgba(76, 201, 240, 1)',
                    'rgba(247, 37, 133, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDarkMode ? '#f8f9fa' : '#212529'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkMode ? '#f8f9fa' : '#212529'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
    
    // Gráfico de categorías
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    
    // Preparar datos para el gráfico de categorías
    const categoryData = summary.expensesByCategory || {};
    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);
    
    // Colores para categorías
    const categoryColors = {
        'food': 'rgba(255, 99, 132, 0.7)',
        'transport': 'rgba(54, 162, 235, 0.7)',
        'housing': 'rgba(255, 206, 86, 0.7)',
        'entertainment': 'rgba(75, 192, 192, 0.7)',
        'shopping': 'rgba(153, 102, 255, 0.7)',
        'health': 'rgba(255, 159, 64, 0.7)',
        'education': 'rgba(199, 199, 199, 0.7)',
        'other': 'rgba(83, 102, 255, 0.7)'
    };
    
    const backgroundColors = categoryLabels.map(category => 
        categoryColors[category] || 'rgba(128, 128, 128, 0.7)'
    );
    
    window.categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryValues,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: isDarkMode ? '#f8f9fa' : '#212529',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// Obtener icono según categoría
function getCategoryIcon(category) {
    const icons = {
        'food': 'fas fa-utensils',
        'transport': 'fas fa-car',
        'housing': 'fas fa-home',
        'entertainment': 'fas fa-film',
        'shopping': 'fas fa-shopping-bag',
        'health': 'fas fa-heartbeat',
        'education': 'fas fa-graduation-cap',
        'salary': 'fas fa-money-bill-wave',
        'investment': 'fas fa-chart-line',
        'other': 'fas fa-ellipsis-h'
    };
    
    return icons[category] || 'fas fa-ellipsis-h';
}

// Formatear fecha
function formatDate(date) {
    return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

// Exportar funciones
window.loadDashboard = loadDashboard;
window.initDashboardData = initDashboardData;
window.displayRecentTransactions = displayRecentTransactions;