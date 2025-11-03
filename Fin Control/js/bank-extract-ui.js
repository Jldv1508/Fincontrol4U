/**
 * bank-extract-ui.js - Interfaz de usuario para el módulo de extractos bancarios
 */

const BankExtractUI = {
    /**
     * Muestra la interfaz para escanear un extracto bancario
     */
    showScanInterface: function() {
        // Crear modal
        const modalContent = `
            <div class="bank-extract-scan">
                <div class="scan-options">
                    <div class="form-group">
                        <label for="bank-select">Banco</label>
                        <select id="bank-select" class="form-control">
                            <option value="BBVA">BBVA</option>
                            <option value="Santander">Santander</option>
                            <option value="CaixaBank">CaixaBank</option>
                            <option value="ING">ING</option>
                            <option value="Generic">Otro banco</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="extract-date">Fecha del extracto</label>
                        <input type="date" id="extract-date" class="form-control" 
                            value="${BankExtractManager.formatDateForInput(new Date())}">
                    </div>
                </div>
                
                <div class="scan-input">
                    <div class="form-group">
                        <label for="extract-text">Texto del extracto bancario</label>
                        <textarea id="extract-text" class="form-control" rows="10" 
                            placeholder="Pega aquí el texto del extracto bancario..."></textarea>
                    </div>
                </div>
                
                <div class="scan-actions">
                    <button id="process-extract-btn" class="btn btn-primary">Procesar extracto</button>
                    <button id="cancel-extract-btn" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
        `;
        
        // Mostrar modal
        window.showModal({
            title: 'Escanear extracto bancario',
            content: modalContent,
            size: 'large',
            onOpen: () => {
                // Configurar eventos
                document.getElementById('process-extract-btn').addEventListener('click', () => {
                    const bank = document.getElementById('bank-select').value;
                    const date = document.getElementById('extract-date').value;
                    const text = document.getElementById('extract-text').value;
                    
                    if (!text) {
                        if (window.NotificationManager) {
                            NotificationManager.show({
                                type: 'error',
                                message: 'Por favor, introduce el texto del extracto'
                            });
                        }
                        return;
                    }
                    
                    // Procesar extracto
                    BankExtractManager.processExtract({
                        bank: bank,
                        date: date,
                        text: text
                    })
                    .then(transactions => {
                        // Cerrar modal
                        window.closeModal();
                        
                        // Mostrar resultados
                        this.showExtractResults(transactions);
                    })
                    .catch(error => {
                        if (window.NotificationManager) {
                            NotificationManager.show({
                                type: 'error',
                                message: `Error al procesar el extracto: ${error.message}`
                            });
                        }
                    });
                });
                
                document.getElementById('cancel-extract-btn').addEventListener('click', () => {
                    window.closeModal();
                });
            }
        });
    },
    
    /**
     * Muestra los resultados del procesamiento de un extracto
     * @param {Array} transactions - Transacciones extraídas
     */
    showExtractResults: function(transactions) {
        // Generar HTML para las transacciones
        let transactionsHTML = '';
        
        transactions.forEach(transaction => {
            const date = transaction.date ? new Date(transaction.date) : new Date();
            const formattedDate = BankExtractManager.formatDate(date);
            const amountClass = transaction.isIncome ? 'income' : 'expense';
            const amountPrefix = transaction.isIncome ? '+' : '-';
            
            transactionsHTML += `
                <div class="transaction-item" data-id="${transaction.id}">
                    <div class="transaction-details">
                        <div class="transaction-title">${transaction.description}</div>
                        <div class="transaction-date">${formattedDate}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix}${transaction.amount.toFixed(2)} €
                    </div>
                    <div class="transaction-actions">
                        <button class="btn-icon add-to-app" title="Añadir a la aplicación">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn-icon assign-family" title="Asignar familia">
                            <i class="fas fa-users"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        // Crear modal con resultados
        const modalContent = `
            <div class="extract-results">
                <div class="results-summary">
                    <p>Se han encontrado ${transactions.length} transacciones en el extracto.</p>
                </div>
                
                <div class="transactions-container">
                    ${transactionsHTML}
                </div>
                
                <div class="results-actions">
                    <button id="add-all-btn" class="btn btn-primary">Añadir todas</button>
                    <button id="close-results-btn" class="btn btn-secondary">Cerrar</button>
                </div>
            </div>
        `;
        
        // Mostrar modal
        window.showModal({
            title: 'Resultados del extracto bancario',
            content: modalContent,
            size: 'large',
            onOpen: () => {
                // Configurar eventos
                document.getElementById('add-all-btn').addEventListener('click', () => {
                    this.addAllTransactionsToApp(transactions);
                    window.closeModal();
                });
                
                document.getElementById('close-results-btn').addEventListener('click', () => {
                    window.closeModal();
                });
                
                // Eventos para botones de acciones individuales
                document.querySelectorAll('.add-to-app').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const transactionId = e.target.closest('.transaction-item').dataset.id;
                        const transaction = transactions.find(t => t.id === transactionId);
                        
                        if (transaction) {
                            this.addTransactionToApp(transaction);
                            e.target.closest('.transaction-item').classList.add('added');
                        }
                    });
                });
                
                document.querySelectorAll('.assign-family').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const transactionId = e.target.closest('.transaction-item').dataset.id;
                        const transaction = transactions.find(t => t.id === transactionId);
                        
                        if (transaction) {
                            FamilyManager.showFamilyAssignmentDialog(transaction);
                        }
                    });
                });
            }
        });
    },
    
    /**
     * Añade todas las transacciones a la aplicación
     * @param {Array} transactions - Transacciones a añadir
     */
    addAllTransactionsToApp: function(transactions) {
        let addedCount = 0;
        
        transactions.forEach(transaction => {
            if (this.addTransactionToApp(transaction)) {
                addedCount++;
            }
        });
        
        // Mostrar notificación
        if (window.NotificationManager) {
            NotificationManager.show({
                type: 'success',
                message: `Se han añadido ${addedCount} transacciones a la aplicación`
            });
        }
    },
    
    /**
     * Añade una transacción a la aplicación
     * @param {Object} transaction - Transacción a añadir
     * @returns {boolean} - True si se añadió correctamente
     */
    addTransactionToApp: function(transaction) {
        try {
            // Convertir a formato de transacción de la aplicación
            const appTransaction = {
                type: transaction.isIncome ? 'income' : 'expense',
                amount: transaction.amount,
                description: transaction.description,
                date: transaction.date || new Date().toISOString().split('T')[0],
                category: '', // Se asignará después
                notes: `Extraído del banco: ${transaction.bank}`
            };
            
            // Añadir a la aplicación
            if (typeof window.addTransaction === 'function') {
                window.addTransaction(appTransaction);
                return true;
            } else {
                console.error('Función addTransaction no disponible');
                return false;
            }
        } catch (error) {
            console.error('Error al añadir transacción:', error);
            return false;
        }
    }
};

// Exportar para uso global
window.BankExtractUI = BankExtractUI;